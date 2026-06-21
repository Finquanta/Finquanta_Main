import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { UserRole } from '../users/types';
import { JWTManager, JWTPayload } from './jwt';
import { PasswordManager } from './password';

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