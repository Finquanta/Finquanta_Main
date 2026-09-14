import crypto from 'crypto';
import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { PasswordManager } from '../auth/password';

/** Who someone is on the real site, as production vouches for them. */
export interface ProductionIdentity {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
}

const ROLES: string[] = [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OWNER];

type BetaUser = NonNullable<Awaited<ReturnType<UserRepository['findByEmail']>>>;

/**
 * On beta: the account for someone the real site vouches for, created on first
 * use. Nobody signs up on beta.
 *
 * The password is random and never shown — signing in on beta only ever goes
 * through the real site ("Open in beta"), so beta holds no usable password.
 *
 * The role follows production's, so staff keep their admin panel on beta.
 */
export async function findOrCreateBetaUser(database: Database, identity: ProductionIdentity): Promise<BetaUser> {
  const users = new UserRepository(database);
  let user = await users.findByEmail(identity.email);

  if (!user) {
    const passwordHash = await new PasswordManager().hash(crypto.randomBytes(32).toString('hex'));
    user = await users.create({
      email: identity.email,
      passwordHash,
      firstName: identity.firstName ?? '',
      lastName: identity.lastName ?? '',
      role: UserRole.USER,
      // Accepted on the real site, where they created their account.
      acceptedTerms: true,
      acceptedPrivacy: true,
      acceptedRisk: true,
    });
  }

  if (identity.role && ROLES.includes(identity.role) && identity.role !== user.role) {
    await database.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [user.id, identity.role]);
    user = (await users.findById(user.id)) ?? user;
  }
  return user;
}

/**
 * On beta: add someone to every copied workspace whose owner ticked them.
 *
 * The owner ticks testers on the real site; beta only receives their email and
 * role, and the invite waits in beta_member_invites until they first open beta.
 *
 * No-op off beta. Never throws into the caller: joining a test workspace must
 * not be able to fail a sign-in.
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
