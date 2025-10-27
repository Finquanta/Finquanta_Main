import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export class JWTManager {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly issuer = 'fiscal-ai';
  private readonly audience = 'fiscal-ai';

  constructor() {
    // In production, these should come from environment variables
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-key-for-development-only';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-for-development-only';
  }

  /**
   * Generate an access token with 15 minute expiry
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: '15m',
      issuer: this.issuer,
      audience: this.audience
    });
  }

  /**
   * Generate a refresh token with 7 day expiry
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: '7d',
      issuer: this.issuer,
      audience: this.audience
    });
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid access token: ${error.message}`);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error(`Access token expired: ${error.message}`);
      } else {
        throw new Error(`Access token verification failed: ${error}`);
      }
    }
  }

  /**
   * Verify a refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid refresh token: ${error.message}`);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error(`Refresh token expired: ${error.message}`);
      } else {
        throw new Error(`Refresh token verification failed: ${error}`);
      }
    }
  }
}