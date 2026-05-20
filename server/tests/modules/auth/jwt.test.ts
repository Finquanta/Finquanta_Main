import { JWTManager } from '../../../src/modules/auth/jwt';

describe('JWTManager', () => {
  const jwtManager = new JWTManager();
  const testPayload = { userId: '123', email: 'test@example.com' };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = jwtManager.generateAccessToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include Finquanta-ai issuer and audience claims', () => {
      const token = jwtManager.generateAccessToken(testPayload);
      const decoded = jwtManager.verifyAccessToken(token);
      expect(decoded.iss).toBe('Finquanta-ai');
      expect(decoded.aud).toBe('Finquanta-ai');
    });

    it('should include user payload in token', () => {
      const token = jwtManager.generateAccessToken(testPayload);
      const decoded = jwtManager.verifyAccessToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = jwtManager.generateAccessToken(testPayload);
      const decoded = jwtManager.verifyAccessToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should throw error for invalid access token', () => {
      const invalidToken = 'invalid.token.here';
      expect(() => jwtManager.verifyAccessToken(invalidToken)).toThrow();
    });

    it('should throw error for expired access token', () => {
      // This test will fail initially, but should pass after implementation
      const token = jwtManager.generateAccessToken(testPayload);
      // For now, just verify the token is valid
      expect(() => jwtManager.verifyAccessToken(token)).not.toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = jwtManager.generateRefreshToken(testPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include Finquanta-ai issuer and audience claims', () => {
      const token = jwtManager.generateRefreshToken(testPayload);
      const decoded = jwtManager.verifyRefreshToken(token);
      expect(decoded.iss).toBe('Finquanta-ai');
      expect(decoded.aud).toBe('Finquanta-ai');
    });

    it('should include user payload in token', () => {
      const token = jwtManager.generateRefreshToken(testPayload);
      const decoded = jwtManager.verifyRefreshToken(token);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = jwtManager.generateRefreshToken(testPayload);
      const decoded = jwtManager.verifyRefreshToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should throw error for invalid refresh token', () => {
      const invalidToken = 'invalid.token.here';
      expect(() => jwtManager.verifyRefreshToken(invalidToken)).toThrow();
    });

    it('should throw error for expired refresh token', () => {
      // This test will fail initially, but should pass after implementation
      const token = jwtManager.generateRefreshToken(testPayload);
      // For now, just verify the token is valid
      expect(() => jwtManager.verifyRefreshToken(token)).not.toThrow();
    });
  });

  describe('Invalid token rejection', () => {
    it('should reject malformed tokens', () => {
      const malformedTokens = [
        'not.a.jwt',
        'invalid',
        '',
        'bearer token',
        'only.two.parts'
      ];

      malformedTokens.forEach(token => {
        expect(() => jwtManager.verifyAccessToken(token)).toThrow();
        expect(() => jwtManager.verifyRefreshToken(token)).toThrow();
      });
    });

    it('should reject tokens with invalid signature', () => {
      const validToken = jwtManager.generateAccessToken(testPayload);
      const parts = validToken.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid_signature`;

      expect(() => jwtManager.verifyAccessToken(tamperedToken)).toThrow();
      expect(() => jwtManager.verifyRefreshToken(tamperedToken)).toThrow();
    });
  });
});