import { Database } from '../../infrastructure/database';

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
export async function deleteUserAccount(database: Database, userId: string): Promise<boolean> {
  // The users row is deleted on the same client, inside the same BEGIN/COMMIT:
  // a separate query would take a different pooled connection and commit the
  // ledger teardown on its own, so a failure there would destroy the financial
  // history while leaving the account standing — the exact split this
  // transaction exists to prevent.
  return database.transaction(async (client) => {
    await client.query(
      `DELETE FROM journal_entries
        WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = $1)`,
      [userId]
    );
    const result = await client.query('DELETE FROM users WHERE id = $1', [userId]);
    return (result.rowCount ?? 0) > 0;
  });
}
