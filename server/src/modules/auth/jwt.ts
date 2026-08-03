import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  /**
   * Unique per refresh token issuance. `iat` alone has only 1-second
   * resolution, so two refresh tokens for the same user minted within the
   * same second would otherwise be byte-identical — colliding on the
   * `refresh_tokens.token_hash` UNIQUE constraint and getting a legitimate
   * refresh rejected as invalid.
   */
  jti?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export class JWTManager {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly issuer = 'Finquanta-ai';
  private readonly audience = 'Finquanta-ai';

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(`Invalid refresh token: ${error.message}`);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error(`Refresh token expired: ${error.message}`);
      } else {
        throw new Error(`Refresh token verification failed: ${error}`);
      }
    }
  }

  /**
   * A short-lived token for the gap between "password correct" and "2FA code
   * correct" during login. Signed with the REFRESH secret (not the access
   * secret) so it can never be mistaken for — or accepted as — a real access
   * token by `authenticate()`, which verifies against the access secret via
   * @fastify/jwt. The `purpose` claim is a second guard against reuse if that
   * secret were ever shared some other way.
   */
  generate2faChallengeToken(userId: string): string {
    return jwt.sign({ userId, purpose: '2fa-challenge' }, this.refreshTokenSecret, {
      expiresIn: '5m',
      issuer: this.issuer,
      audience: this.audience
    });
  }

  verify2faChallengeToken(token: string): { userId: string } {
    let decoded: JWTPayload & { purpose?: string };
    try {
      decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience
      }) as JWTPayload & { purpose?: string };
    } catch {
      throw new Error('Invalid or expired two-factor challenge');
    }
    if (decoded.purpose !== '2fa-challenge') {
      throw new Error('Invalid or expired two-factor challenge');
    }
    return { userId: decoded.userId };
  }
}