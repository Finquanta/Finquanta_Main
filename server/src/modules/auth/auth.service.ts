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

    // Validate password strength
    this.validatePassword(userData.password);

    // Hash password
    const passwordHash = await this.passwordManager.hash(userData.password);

    // Create user
    const user = await this.userRepository.create({
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: UserRole.USER
    });

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