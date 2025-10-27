import { PasswordManager } from '../../../src/modules/auth/password';

describe('PasswordManager', () => {
  let passwordManager: PasswordManager;

  beforeEach(() => {
    passwordManager = new PasswordManager();
  });

  describe('hash', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await passwordManager.hash(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await passwordManager.hash(password);
      const hash2 = await passwordManager.hash(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify a correct password successfully', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await passwordManager.hash(password);

      const isValid = await passwordManager.verify(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hashedPassword = await passwordManager.hash(password);

      const isValid = await passwordManager.verify(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should handle empty password string', async () => {
      const password = '';
      const hashedPassword = await passwordManager.hash(password);

      const isValid = await passwordManager.verify(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject verification against empty hash', async () => {
      const password = 'testPassword123!';
      const emptyHash = '';

      const isValid = await passwordManager.verify(password, emptyHash);
      expect(isValid).toBe(false);
    });

    it('should reject verification against invalid hash format', async () => {
      const password = 'testPassword123!';
      const invalidHash = 'invalid_hash_format';

      const isValid = await passwordManager.verify(password, invalidHash);
      expect(isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hashedPassword = await passwordManager.hash(longPassword);

      const isValid = await passwordManager.verify(longPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should handle passwords with special characters', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hashedPassword = await passwordManager.hash(specialPassword);

      const isValid = await passwordManager.verify(specialPassword, hashedPassword);
      expect(isValid).toBe(true);
    });
  });
});