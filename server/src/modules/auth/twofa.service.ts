import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { UserRepository } from '../users/user.repository';

// Tolerate one 30s step of clock drift either side — otplib's default (0) is
// stricter than most authenticator apps expect from a server.
authenticator.options = { window: 1 };

const BACKUP_CODE_COUNT = 8;
const ISSUER = 'Finquanta';

/** Two-factor authentication (TOTP), RFC 6238 — Google Authenticator, Authy, etc. all compatible. */
export class TwoFactorService {
  constructor(private userRepository: UserRepository) {}

  /** Start (or restart) enrollment: a fresh secret, not yet enabled, plus a scannable QR. */
  async startEnrollment(userId: string, email: string): Promise<{ secret: string; qrDataUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.userRepository.setPendingTotpSecret(userId, secret);
    const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrDataUrl };
  }

  /**
   * Complete enrollment: the user must prove they actually scanned the QR (a
   * correct live code) before 2FA turns on. Issues backup codes ONCE, in
   * plaintext — only their hashes are ever stored, so this is the only chance
   * to show them.
   */
  async confirmEnrollment(userId: string, code: string): Promise<string[]> {
    const totp = await this.userRepository.getTotp(userId);
    if (!totp?.secret) throw new Error('No two-factor enrollment in progress. Start over.');
    if (!authenticator.check(code, totp.secret)) {
      throw new Error('Incorrect code. Check the time on your device and try again.');
    }
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => this.generateBackupCode());
    await this.userRepository.enableTotp(userId, backupCodes.map((c) => this.hashBackupCode(c)));
    return backupCodes;
  }

  async disable(userId: string): Promise<void> {
    await this.userRepository.disableTotp(userId);
  }

  async isEnabled(userId: string): Promise<boolean> {
    const totp = await this.userRepository.getTotp(userId);
    return !!totp?.enabled;
  }

  /** Verify a login-time code: a live 6-digit TOTP, or a one-time backup code (consumed if used). */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const totp = await this.userRepository.getTotp(userId);
    if (!totp?.enabled || !totp.secret || !code) return false;

    if (authenticator.check(code, totp.secret)) return true;

    const backupHash = this.hashBackupCode(code);
    if (totp.backupCodeHashes.includes(backupHash)) {
      await this.userRepository.consumeBackupCode(userId, backupHash);
      return true;
    }
    return false;
  }

  /** e.g. "a1b2c-d3e4f" — short enough to write down, long enough not to guess. */
  private generateBackupCode(): string {
    const raw = crypto.randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }

  /** Case/format-insensitive so "A1B2C-D3E4F" and "a1b2cd3e4f" both match what was shown. */
  private hashBackupCode(code: string): string {
    const normalized = code.replace(/[\s-]/g, '').toLowerCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
