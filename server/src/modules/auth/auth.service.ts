import crypto from 'crypto';
import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { JWTManager, JWTPayload } from './jwt';
import { PasswordManager } from './password';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TwoFactorService } from './twofa.service';
import { sendEmail } from '../../infrastructure/email';
import { appUrl, renderEmail } from '../../infrastructure/email-template';
import { isPasswordPwned } from '../../infrastructure/pwned';
import { ReferralsRepository } from '../referrals/referrals.repository';
import { BillingRepository } from '../billing/billing.repository';
import { TRIAL_DAYS_UNVERIFIED, TRIAL_DAYS_VERIFIED } from '../billing/plans';
/** 14 verified minus 7 unverified — the difference verifying is worth. */
const TRIAL_VERIFY_BONUS_DAYS = TRIAL_DAYS_VERIFIED - TRIAL_DAYS_UNVERIFIED;
import {
  BusinessesRepository, DEFAULT_BUSINESS_NAME, PLACEHOLDER_BUSINESS_NAMES,
} from '../businesses/businesses.repository';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string; // 'YYYY-MM-DD'
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  acceptedRisk?: boolean;
  /** Whoever's link they arrived on. Optional, and never blocks signup. */
  referralCode?: string;
}

const MIN_AGE_YEARS = 16;

/**
 * The default workspace name and the set of names that count as "never named"
 * now live in businesses.repository — this file imports that one, so defining
 * them here and importing them back would be a cycle. Re-exported so existing
 * `from '../auth/auth.service'` importers keep working.
 */
export { DEFAULT_BUSINESS_NAME, PLACEHOLDER_BUSINESS_NAMES };

/** A verification failure carrying a machine-readable reason for the UI. */
export type VerificationErrorReason = 'invalid' | 'expired';
export class VerificationError extends Error {
  constructor(public reason: VerificationErrorReason, message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

/** Whole years between a 'YYYY-MM-DD' date of birth and now. NaN if invalid. */
function ageInYears(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenData {
  refreshToken: string;
}

/** Returned instead of AuthResponse when the account has 2FA enabled — the caller must call verifyTwoFactorLogin next. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private jwtManager: JWTManager;
  private passwordManager: PasswordManager;
  private refreshTokenRepository: RefreshTokenRepository;
  private twoFactorService: TwoFactorService;

  constructor(private database: Database) {
    this.userRepository = new UserRepository(database);
    this.jwtManager = new JWTManager();
    this.passwordManager = new PasswordManager();
    this.refreshTokenRepository = new RefreshTokenRepository(database);
    this.twoFactorService = new TwoFactorService(this.userRepository);
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Age gate: must be at least 16, computed from a valid date of birth.
    const age = ageInYears(userData.dateOfBirth || '');
    if (isNaN(age)) {
      throw new Error('Please enter a valid date of birth');
    }
    if (age < MIN_AGE_YEARS) {
      throw new Error(`You must be at least ${MIN_AGE_YEARS} years old to create an account`);
    }

    // All required legal agreements must be accepted.
    if (!userData.acceptedTerms || !userData.acceptedPrivacy || !userData.acceptedRisk) {
      throw new Error('You must accept the Terms & Conditions, Privacy Policy, and Risk Disclosure');
    }

    // Validate password strength
    await this.validatePassword(userData.password);

    // Hash password
    const passwordHash = await this.passwordManager.hash(userData.password);

    // Create user (records DOB and acceptance timestamps)
    const user = await this.userRepository.create({
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: UserRole.USER,
      dateOfBirth: userData.dateOfBirth,
      acceptedTerms: userData.acceptedTerms,
      acceptedPrivacy: userData.acceptedPrivacy,
      acceptedRisk: userData.acceptedRisk
    });

    // Give the account the workspace everything else is scoped to.
    //
    // Without one, `withBusiness` 409s "No business found for this user" on
    // every write, so a fresh account can't record a single transaction. Until
    // now the only things that created a business were the WorkspaceSwitcher's
    // Create button and the backfill in BusinessesRepository.ensureSchema(),
    // which runs at BOOT — so anyone who signed up between two restarts had a
    // broken account. On Render's free tier the server sleeps and restarts often
    // enough to hide it; against a long-running server it doesn't.
    //
    // Non-fatal on purpose: the user row already exists at this point, so
    // throwing here would fail an otherwise-good signup and strand the account.
    // `withBusiness` creates one on demand as a second line of defence.
    try {
      const businesses = new BusinessesRepository(this.database);
      await businesses.create(user.id, DEFAULT_BUSINESS_NAME);
    } catch (error) {
      console.error('DEFAULT BUSINESS ERROR:', error instanceof Error ? error.message : String(error));
    }

    // Send the "confirm your email" link (non-fatal — signup still succeeds if
    // email delivery fails; the user can resend later).
    try {
      await this.sendVerificationEmail(user.id, user.email);
    } catch (error) {
      console.error('VERIFICATION EMAIL ERROR:', error instanceof Error ? error.message : String(error));
    }

    // Credit whoever referred them (Section 13). Also non-fatal: a bad or stale
    // referral code must never stop someone creating an account.
    try {
      const referrals = new ReferralsRepository(this.database);
      await referrals.ensureSchema();
      await referrals.attribute(userData.referralCode, user.id);
    } catch (error) {
      console.error('REFERRAL ATTRIBUTION ERROR:', error instanceof Error ? error.message : String(error));
    }

    // Generate tokens (drop the internal DB id — the client only gets the JWTs)
    const { refreshTokenId: _refreshTokenId, ...tokens } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      ...tokens
    };
  }

  /** Generate + store a verification token and email the confirm link. */
  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.userRepository.setVerificationToken(userId, tokenHash, expiresAt);

    const link = `${appUrl()}/verify-email?token=${rawToken}`;
    // No unsubscribe: this is transactional, and there is nothing to opt out of.
    const html = renderEmail({
      title: 'Confirm your Finquanta email',
      sections: [{
        paragraphs: [
          'Welcome! Please confirm your email address to finish setting up your account. This link is valid for 24 hours.',
          'Confirming also adds 7 days to your free trial, as long as the trial is still running.',
        ],
        cta: { label: 'Confirm email', url: link },
      }],
      rawLink: link,
    });
    await sendEmail({ to: email, subject: 'Confirm your Finquanta email', html });
  }

  /**
   * Confirm an email using a token from the emailed link.
   *
   * Idempotent by design (see findByVerificationTokenHash): a link that was
   * already used — by the user, a refresh, or an email link-scanner that
   * pre-fetched it — resolves to 'already' rather than an error. Only a token we
   * can't find at all (never issued, or replaced by a newer resend) or one that
   * lapsed before it was ever confirmed is treated as a failure.
   */
  async verifyEmail(token: string): Promise<'verified' | 'already'> {
    if (!token) throw new VerificationError('invalid', 'This verification link is invalid.');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = await this.userRepository.findByVerificationTokenHash(tokenHash);
    if (!row) {
      throw new VerificationError(
        'invalid',
        'This link is invalid or has been replaced by a newer verification email.'
      );
    }
    if (row.verified) return 'already';
    if (row.expired) {
      throw new VerificationError('expired', 'This verification link has expired. Request a new one below.');
    }
    await this.userRepository.markEmailVerified(row.id);

    /**
     * The +7 days for verifying, awarded automatically.
     *
     * Spec 08 §4.1: 7 days unverified, 14 verified, and verifying later tops
     * the difference up — so starting a trial before confirming your address
     * never costs you a week. Nothing implemented it until now.
     *
     * Automatic rather than a "claim your days" button: making somebody verify
     * AND then find a second button is two steps for one decision, and whoever
     * misses the second one silently loses the time.
     *
     * Cannot fail the verification. Somebody confirming their email must end up
     * verified whatever happens to their trial — the days are a bonus, and a
     * bonus that can lock you out of your account is not one.
     */
    try {
      await new BillingRepository(this.database).awardVerificationBonus(row.id, TRIAL_VERIFY_BONUS_DAYS);
    } catch (error) {
      console.error('Could not extend the trial after verification:', error);
    }

    return 'verified';
  }

  /**
   * Re-send a verification email. Returns a status so the UI can be honest:
   * an already-verified account is told to just log in (rather than waiting for
   * an email that never comes), while unknown emails and freshly-sent ones are
   * reported the same way so we don't leak which addresses are unverified.
   * Throttled to one send per minute to prevent resend spam.
   */
  async resendVerification(email: string): Promise<'sent' | 'already_verified' | 'unknown'> {
    const u = await this.userRepository.findForVerification(email);
    if (!u) return 'unknown';
    if (u.verified) return 'already_verified';
    // Cooldown: the token's expiry is (issued + 24h), so recover the issue time.
    if (u.tokenExpiresAt) {
      const issuedAt = u.tokenExpiresAt.getTime() - 24 * 60 * 60 * 1000;
      if (Date.now() - issuedAt < 60 * 1000) return 'sent';
    }
    await this.sendVerificationEmail(u.id, u.email);
    return 'sent';
  }

  async login(loginData: LoginData): Promise<AuthResponse | TwoFactorChallenge> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginData.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.passwordManager.verify(loginData.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Block suspended ("restricted") accounts.
    if (user.status === 'suspended') {
      throw new Error('Your account has been suspended. Please contact support.');
    }

    // Password confirmed — if 2FA is on, stop here with a short-lived
    // challenge instead of a real session. The caller must present a valid
    // TOTP/backup code to verifyTwoFactorLogin() to actually get in.
    if (await this.twoFactorService.isEnabled(user.id)) {
      return {
        twoFactorRequired: true,
        challengeToken: this.jwtManager.generate2faChallengeToken(user.id),
      };
    }

    // Generate tokens (drop the internal DB id — the client only gets the JWTs)
    const { refreshTokenId: _refreshTokenId, ...tokens } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      ...tokens
    };
  }

  /** The second step of login for a 2FA-enabled account: exchange a challenge + code for a real session. */
  async verifyTwoFactorLogin(challengeToken: string, code: string): Promise<AuthResponse> {
    let userId: string;
    try {
      ({ userId } = this.jwtManager.verify2faChallengeToken(challengeToken));
    } catch {
      throw new Error('Your two-factor challenge has expired. Please log in again.');
    }

    const ok = await this.twoFactorService.verifyLoginCode(userId, code);
    if (!ok) throw new Error('Incorrect code.');

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('Incorrect code.');

    const { refreshTokenId: _refreshTokenId, ...tokens } = await this.generateTokens(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      ...tokens
    };
  }

  /** Begin (or restart) 2FA enrollment for an already-authenticated user. */
  async startTwoFactorEnrollment(userId: string): Promise<{ secret: string; qrDataUrl: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    return this.twoFactorService.startEnrollment(userId, user.email);
  }

  /** Finish enrollment: proves the user actually scanned the QR, then turns 2FA on and issues backup codes. */
  async confirmTwoFactorEnrollment(userId: string, code: string): Promise<string[]> {
    return this.twoFactorService.confirmEnrollment(userId, code);
  }

  /** Turn 2FA off. Requires the current password again — otherwise a hijacked, already-open session could disable it. */
  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('User not found');
    const isPasswordValid = await this.passwordManager.verify(password, user.passwordHash);
    if (!isPasswordValid) throw new Error('Incorrect password');
    await this.twoFactorService.disable(userId);
  }

  /**
   * Rotates a refresh token: the JWT's own signature/expiry is checked first
   * (cheap, no DB hit for an obviously forged or expired token), then the
   * stored record decides revocation. The old token is revoked as part of
   * issuing the new pair, so a stolen-but-already-used refresh token stops
   * working the moment its legitimate owner refreshes — reusing it throws the
   * same generic error as any other invalid token.
   *
   * Tokens issued before this table existed have no stored record; those are
   * grandfathered in (accepted once, then tracked from here on) rather than
   * forcing every signed-in user to re-login the moment this ships.
   */
  async refreshToken(refreshData: RefreshTokenData): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtManager.verifyRefreshToken(refreshData.refreshToken);
      const tokenHash = crypto.createHash('sha256').update(refreshData.refreshToken).digest('hex');
      const stored = await this.refreshTokenRepository.findByHash(tokenHash);
      if (stored && stored.revokedAt) {
        throw new Error('Refresh token already used');
      }

      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const { refreshTokenId, ...tokens } = await this.generateTokens(user);
      if (stored) {
        await this.refreshTokenRepository.revoke(stored.id, refreshTokenId);
      } else {
        // Pre-dates this table (grandfathered): record it as already-revoked
        // now that it's been used, so a leaked copy of this exact old token
        // can't be replayed indefinitely — the next attempt will find it
        // stored and revoked, same as any other reused token.
        const oldId = await this.refreshTokenRepository.store(payload.userId, tokenHash, new Date((payload.exp ?? 0) * 1000 || Date.now()));
        await this.refreshTokenRepository.revoke(oldId, refreshTokenId);
      }
      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /** Revoke a single refresh token (this session only — other devices stay signed in). */
  async logout(refreshToken: string | undefined | null): Promise<void> {
    if (!refreshToken) return;
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.refreshTokenRepository.revokeByHash(tokenHash);
    } catch (error) {
      console.error('LOGOUT REVOKE ERROR:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Start a password reset: if the email belongs to an active account, store a
   * hashed, 1-hour token and email a reset link. Resolves silently when the
   * email is unknown so we never reveal which addresses are registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || user.status === 'suspended') return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.setResetToken(user.id, tokenHash, expiresAt);

    const link = `${appUrl()}/reset-password?token=${rawToken}`;
    const html = renderEmail({
      title: 'Reset your Finquanta password',
      sections: [{
        paragraphs: ['We received a request to reset your password. This link is valid for 1 hour.'],
        cta: { label: 'Reset password', url: link },
      }],
      footerNote: "If you didn't request this, you can safely ignore this email — your password won't change.",
      rawLink: link,
    });
    await sendEmail({ to: user.email, subject: 'Reset your Finquanta password', html });
  }

  /** Complete a password reset using a token from the emailed link. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token) throw new Error('Invalid or expired reset link');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository.findByValidResetTokenHash(tokenHash);
    if (!user) throw new Error('Invalid or expired reset link');

    await this.validatePassword(newPassword);
    const passwordHash = await this.passwordManager.hash(newPassword);
    await this.userRepository.setPassword(user.id, passwordHash);
  }

  /** Issues a fresh access+refresh pair and records the refresh token's hash so it can later be rotated or revoked. */
  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string; refreshTokenId: string }> {
    const payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      userId: user.id,
      email: user.email
    };

    const accessToken = this.jwtManager.generateAccessToken(payload);
    // A random jti guarantees this refresh token is unique even if issued in
    // the same second as another one for this user (iat alone isn't enough —
    // see JWTPayload.jti).
    const refreshToken = this.jwtManager.generateRefreshToken({ ...payload, jti: crypto.randomUUID() });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    // Mirrors JWTManager's refresh token expiry ('7d').
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const refreshTokenId = await this.refreshTokenRepository.store(user.id, tokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      refreshTokenId
    };
  }

  private async validatePassword(password: string): Promise<void> {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }

    // Any character that isn't a letter, a digit, or a space counts.
    //
    // This used to be an explicit list — [!@#$%^&*(),.?":{}|<>] — which quietly
    // rejected hyphens, underscores, plus, equals, brackets and quotes. Someone
    // choosing "My-Password1" was told to add a special character when they
    // already had one. Widening is strictly more permissive, so no existing
    // password stops working.
    //
    // Mirrored in user/src/lib/password-rules.ts — change both together.
    if (!/[^A-Za-z0-9\s]/.test(password)) {
      throw new Error('Password must contain at least one symbol, like ! ? @ # - _');
    }

    // Checked last (needs a network round-trip) — no point calling out to HIBP
    // for a password that already fails a free, local rule.
    if (await isPasswordPwned(password)) {
      throw new Error('This password has appeared in a known data breach. Please choose a different one.');
    }
  }
}