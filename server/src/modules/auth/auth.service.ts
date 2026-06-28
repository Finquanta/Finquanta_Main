import crypto from 'crypto';
import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { JWTManager, JWTPayload } from './jwt';
import { PasswordManager } from './password';
import { sendEmail } from '../../infrastructure/email';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string; // 'YYYY-MM-DD'
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  acceptedRisk?: boolean;
}

const MIN_AGE_YEARS = 16;

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

export class AuthService {
  private userRepository: UserRepository;
  private jwtManager: JWTManager;
  private passwordManager: PasswordManager;

  constructor(private database: Database) {
    this.userRepository = new UserRepository(database);
    this.jwtManager = new JWTManager();
    this.passwordManager = new PasswordManager();
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
    this.validatePassword(userData.password);

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

    // Send the "confirm your email" link (non-fatal — signup still succeeds if
    // email delivery fails; the user can resend later).
    try {
      await this.sendVerificationEmail(user.id, user.email);
    } catch (error) {
      console.error('VERIFICATION EMAIL ERROR:', error instanceof Error ? error.message : String(error));
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

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

    const base = (process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '')
      .trim()
      .replace(/\/$/, '');
    const link = `${base}/verify-email?token=${rawToken}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0f172a">Confirm your Finquanta email</h2>
        <p style="color:#475569">Welcome! Please confirm your email address to finish setting up your account. This link is valid for 24 hours.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#22c55e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Confirm email</a>
        </p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all">Or paste this link into your browser:<br>${link}</p>
      </div>`;
    await sendEmail({ to: email, subject: 'Confirm your Finquanta email', html });
  }

  /** Confirm an email using a token from the emailed link. */
  async verifyEmail(token: string): Promise<void> {
    if (!token) throw new Error('Invalid or expired verification link');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository.findByValidVerificationTokenHash(tokenHash);
    if (!user) throw new Error('Invalid or expired verification link');
    await this.userRepository.markEmailVerified(user.id);
  }

  /** Re-send a verification email if the account exists and isn't verified yet. */
  async resendVerification(email: string): Promise<void> {
    const u = await this.userRepository.findForVerification(email);
    if (!u || u.verified) return;
    await this.sendVerificationEmail(u.id, u.email);
  }

  async login(loginData: LoginData): Promise<AuthResponse> {
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

    // Generate tokens
    const tokens = await this.generateTokens(user);

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

  async refreshToken(refreshData: RefreshTokenData): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtManager.verifyRefreshToken(refreshData.refreshToken);

      // Find user to ensure they still exist
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
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

    const base = (process.env.APP_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '')
      .trim()
      .replace(/\/$/, '');
    const link = `${base}/reset-password?token=${rawToken}`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0f172a">Reset your Finquanta password</h2>
        <p style="color:#475569">We received a request to reset your password. This link is valid for 1 hour.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#22c55e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Reset password</a>
        </p>
        <p style="color:#94a3b8;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        <p style="color:#94a3b8;font-size:12px;word-break:break-all">Or paste this link into your browser:<br>${link}</p>
      </div>`;
    await sendEmail({ to: user.email, subject: 'Reset your Finquanta password', html });
  }

  /** Complete a password reset using a token from the emailed link. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token) throw new Error('Invalid or expired reset link');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.userRepository.findByValidResetTokenHash(tokenHash);
    if (!user) throw new Error('Invalid or expired reset link');

    this.validatePassword(newPassword);
    const passwordHash = await this.passwordManager.hash(newPassword);
    await this.userRepository.setPassword(user.id, passwordHash);
  }

  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      userId: user.id,
      email: user.email
    };

    const accessToken = this.jwtManager.generateAccessToken(payload);
    const refreshToken = this.jwtManager.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken
    };
  }

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }
}