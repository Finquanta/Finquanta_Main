import { Database } from '../../infrastructure/database';

/**
 * On beta: add someone to every imported workspace whose owner ticked them.
 *
 * The owner chooses members on the real site; beta only receives their email
 * and role. A ticked member may not have a beta account yet, so the invite
 * waits in beta_member_invites and is claimed here — at signup, and at login for
 * someone who already had an account.
 *
 * No-op off beta. Never throws into the caller: joining a test workspace must
 * not be able to fail a login.
 */
export async function claimBetaMemberInvites(database: Database, userId: string): Promise<void> {
  if (process.env.BETA_SITE !== 'true') return;
  try {
    await database.query(
      `INSERT INTO business_members (business_id, user_id, role)
       SELECT i.business_id, u.id, i.role
         FROM beta_member_invites i
         JOIN users u ON lower(u.email) = i.email
         JOIN businesses b ON b.id = i.business_id
        WHERE u.id = $1
       ON CONFLICT (business_id, user_id) DO NOTHING`,
      [userId]
    );
  } catch (error) {
    console.error('BETA MEMBER CLAIM ERROR:', error instanceof Error ? error.message : String(error));
  }
}
