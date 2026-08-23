import { Database } from '../../infrastructure/database';
import { syncSeats } from '../billing/seats';
import { stopBillingForBusinesses } from '../billing/stop-billing';

/**
 * Permanently deletes a user and everything cascading off them — the single
 * teardown both delete paths go through (the user's own "delete my account" in
 * profile, and an admin deleting someone from the admin panel). Returns true if
 * a user row was actually removed.
 *
 * `businesses.owner_id` and everything under a business (invoices, ledger,
 * groups, ...) cascade on delete, so this wipes their entire business's
 * financial history too — irreversible by design, matching how delete already
 * works elsewhere in this app.
 *
 * The ledger has to be torn down by hand first. `accounts` cascades from
 * `businesses`, but `journal_lines.account_id` is ON DELETE RESTRICT — a
 * deliberate guard that stops anyone dropping a chart-of-accounts row that
 * still has postings against it. Postgres doesn't order the cascade for us, so
 * if it reaches `accounts` before `journal_entries` the RESTRICT aborts the
 * whole delete with:
 *
 *   update or delete on table "accounts" violates foreign key constraint
 *   "journal_lines_account_id_fkey" on table "journal_lines"
 *
 * Deleting the entries first takes their lines with them (that FK does
 * cascade), which leaves `accounts` unreferenced and free to go. Done in one
 * transaction so a failure can't leave a business with its ledger removed but
 * the account still standing.
 *
 * This lives here rather than in either repository because having it in only
 * one of them is exactly how the admin panel ended up 500ing on any user who
 * had posted a transaction: profile got the fix, admin kept a bare
 * `DELETE FROM users`. Both call this now — anything the cascade needs ordered
 * belongs in this function, not in a caller.
 */
/** Who pressed the button. Self-serve leaves `actorId` null — nobody else acted. */
export interface DeletionActor {
  actorId?: string | null;
  actorEmail?: string | null;
  /** 'self' when the account holder did it, 'admin' from the admin panel. */
  source: 'self' | 'admin';
}

/**
 * The permanent record of a deletion, written INSIDE the teardown transaction.
 *
 * A deleted user leaves nothing behind: `users` is gone and every FK cascades
 * off it, so afterwards there is no way to answer "whose account was that?".
 * `admin_audit_logs` only half-covers it — the admin panel writes an entry when
 * an admin deletes somebody, but a person deleting their OWN account through
 * profile settings was recorded nowhere at all. That is the more common case
 * and the more important one to be able to answer questions about later.
 *
 * The identifying fields are copied in rather than referenced, precisely
 * because the row they came from is about to stop existing. No FK to `users`
 * for the same reason — a foreign key here would either block the delete or
 * cascade the evidence away with it.
 */
export async function ensureAccountDeletionsSchema(database: Database): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS account_deletions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      source VARCHAR(16) NOT NULL DEFAULT 'self',
      actor_id UUID,
      actor_email VARCHAR(255),
      workspaces_destroyed INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
  await database.query(
    `CREATE INDEX IF NOT EXISTS idx_account_deletions_created ON account_deletions(created_at DESC)`
  );
}

export async function deleteUserAccount(
  database: Database,
  userId: string,
  actor: DeletionActor = { source: 'self' }
): Promise<boolean> {
  // The users row is deleted on the same client, inside the same BEGIN/COMMIT:
  // a separate query would take a different pooled connection and commit the
  // ledger teardown on its own, so a failure there would destroy the financial
  // history while leaving the account standing — the exact split this
  // transaction exists to prevent.
  const { deleted, seatChanges, billedBusinesses } = await database.transaction(async (client) => {
    /**
     * Which workspaces are about to lose a seat — read on the transaction
     * client, before the cascade removes the evidence.
     *
     * Only workspaces they do NOT own: the ones they own are being deleted
     * with them, so there is nothing left to bill. Anything they were merely a
     * member of survives one seat lighter, and would otherwise keep being
     * charged for somebody who no longer exists.
     */
    const memberships = await client.query(
      `SELECT m.business_id FROM business_members m
         JOIN businesses b ON b.id = m.business_id
        WHERE m.user_id = $1 AND b.owner_id <> $1`,
      [userId]
    );

    /**
     * The workspaces about to be destroyed with this account, read before the
     * cascade removes them. Any subscription on one of these has to be
     * cancelled at Stripe, or the card keeps being charged for a workspace that
     * no longer exists.
     */
    const owned = await client.query('SELECT id FROM businesses WHERE owner_id = $1', [userId]);

    /**
     * Who this was, read while the row still exists. One query earlier and the
     * cascade below erases the only copy of it.
     */
    const who = await client.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const u = who.rows[0];

    await client.query(
      `DELETE FROM journal_entries
        WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = $1)`,
      [userId]
    );
    const result = await client.query('DELETE FROM users WHERE id = $1', [userId]);

    /**
     * Written on the SAME client, inside the SAME transaction as the delete.
     *
     * If the deletion rolls back, so does this — a record of a deletion that
     * did not happen is worse than no record. And because `account_deletions`
     * has no FK to `users`, the row survives the cascade that just removed
     * everything else about them.
     */
    if ((result.rowCount ?? 0) > 0 && u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null;
      await client.query(
        `INSERT INTO account_deletions
           (user_id, email, name, source, actor_id, actor_email, workspaces_destroyed)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          u.email ?? null,
          name,
          actor.source,
          actor.actorId ?? null,
          actor.actorEmail ?? null,
          (owned.rows ?? []).length,
        ]
      );
    }
    return {
      deleted: (result.rowCount ?? 0) > 0,
      seatChanges: (memberships.rows ?? []).map((r: any) => r.business_id),
      billedBusinesses: (owned.rows ?? []).map((r: any) => r.id),
    };
  });

  /**
   * Billing is settled AFTER the transaction commits, never inside it.
   *
   * syncSeats calls Stripe over the network, and holding a transaction open
   * across an external call turns a slow third party into a lock on the users
   * table. It cannot throw, so a billing hiccup can never fail a deletion that
   * has already happened.
   */
  if (deleted) {
    /**
     * Stop the money first, then correct the seat counts.
     *
     * Cancelling is the one with a deadline — every day it is missed is another
     * charge — while a stale seat count costs a proration at worst. Neither can
     * throw, so an outage in one does not skip the other.
     */
    await stopBillingForBusinesses(database, billedBusinesses);
    for (const businessId of seatChanges) await syncSeats(database, businessId);
  }
  return deleted;
}
