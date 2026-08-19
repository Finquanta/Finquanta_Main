import { Database } from '../../infrastructure/database';

/**
 * Hand a business to one of its existing members.
 *
 * Ownership lives in TWO places — `businesses.owner_id` and the `Owner` row in
 * `business_members` — and almost everything that matters reads one or the
 * other. `withBusiness` and the admin panel go by `owner_id`; the team list,
 * the invite guard and "the owner cannot be removed" go by the member role. A
 * transfer that updated only one would leave a workspace with two owners by one
 * reckoning and none by the other, so both move together inside a transaction.
 *
 * THE OUTGOING OWNER BECOMES AN ADMIN, not nothing. Handing over a business is
 * not the same as leaving it: an accountant transferring to a colleague still
 * needs to work there tomorrow. Anyone who actually wants out calls leave
 * afterwards, which is a separate, deliberate act.
 *
 * Callers must check permission first — this function is the mechanism, not the
 * policy, and account deletion uses it on behalf of someone who is about to
 * stop existing.
 */
export async function transferOwnership(
  database: Database,
  businessId: string,
  newOwnerId: string
): Promise<void> {
  await database.transaction(async (client) => {
    const current = await client.query(
      'SELECT owner_id FROM businesses WHERE id = $1 FOR UPDATE',
      [businessId]
    );
    const previousOwnerId: string | undefined = current.rows[0]?.owner_id;
    if (!previousOwnerId) throw new Error('Business not found');
    if (previousOwnerId === newOwnerId) return; // already theirs; nothing to do

    /**
     * The new owner must ALREADY be a member.
     *
     * Checked here rather than trusted from the caller because this is the
     * point where an id becomes control of a company's books. Accepting an
     * arbitrary user id would turn "transfer ownership" into a way to hand a
     * workspace to a stranger who was never invited to it.
     */
    const member = await client.query(
      'SELECT 1 FROM business_members WHERE business_id = $1 AND user_id = $2',
      [businessId, newOwnerId]
    );
    if (member.rowCount === 0) {
      throw new Error('That person is not a member of this business');
    }

    await client.query('UPDATE businesses SET owner_id = $2, updated_at = NOW() WHERE id = $1', [
      businessId,
      newOwnerId,
    ]);
    await client.query(
      `UPDATE business_members SET role = 'Owner' WHERE business_id = $1 AND user_id = $2`,
      [businessId, newOwnerId]
    );
    // Only if they are still a member: deletion transfers on the way out, and
    // by then their membership row may already be going.
    await client.query(
      `UPDATE business_members SET role = 'Admin'
        WHERE business_id = $1 AND user_id = $2 AND role = 'Owner'`,
      [businessId, previousOwnerId]
    );
  });
}

export interface OwnedBusinessNeedingSuccessor {
  id: string;
  name: string;
  /** Everyone except the departing owner. */
  otherMembers: number;
}

/**
 * Businesses this user owns that OTHER PEOPLE are in.
 *
 * The question asked before an account is deleted. Deleting a user cascades
 * their owned businesses and every ledger under them, so a sole owner of a
 * team workspace can currently erase four colleagues' books by closing their
 * own account. These are the workspaces that need somebody nominated first.
 *
 * A workspace they own ALONE is not listed: there is nobody to hand it to, and
 * deleting it along with the account is the behaviour people expect.
 */
export async function ownedBusinessesNeedingSuccessor(
  database: Database,
  userId: string
): Promise<OwnedBusinessNeedingSuccessor[]> {
  const r = await database.query(
    `SELECT b.id, b.name,
            (SELECT COUNT(*) FROM business_members m
              WHERE m.business_id = b.id AND m.user_id <> $1)::int AS other_members
       FROM businesses b
      WHERE b.owner_id = $1
        AND EXISTS (SELECT 1 FROM business_members m
                     WHERE m.business_id = b.id AND m.user_id <> $1)
      ORDER BY b.created_at ASC`,
    [userId]
  );
  return r.rows.map((x: any) => ({
    id: x.id,
    name: x.name ?? '',
    otherMembers: Number(x.other_members) || 0,
  }));
}
