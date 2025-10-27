import bcrypt from 'bcrypt';

export class PasswordManager {
  private readonly saltRounds = 12;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, hashedPassword: string): Promise<boolean> {
    if (!hashedPassword) {
      return false;
    }

    try {
      return bcrypt.compare(password, hashedPassword);
    } catch {
      return false;
    }
  }
}