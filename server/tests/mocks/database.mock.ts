import { Database } from '../../src/infrastructure/database';
import { User, UserRole } from '../../src/modules/users/types';

export class MockDatabase extends Database {
  private users: User[] = [];
  private nextId = 1;
  private refreshTokens: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    revoked_at: Date | null;
  }[] = [];
  private nextRefreshTokenId = 1;

  constructor() {
    super(); // Call parent constructor but don't connect
  }

  override async connect(): Promise<void> {
    // Mock connection - do nothing
  }

  override async disconnect(): Promise<void> {
    // Mock disconnection - do nothing
  }

  override isConnected(): boolean {
    return true; // Always connected in mock
  }

  override async query(text: string, params?: any[]): Promise<any> {
    // Refresh tokens are persisted now, so registration and login both write to
    // this table and read the id straight back. Without a case for it the mock
    // fell through to the empty default and `r.rows[0].id` threw, taking every
    // register/login/refresh test with it.
    //
    // Handled before the generic user branches below, whose loose `SELECT ...
    // WHERE id =` match would otherwise swallow the token lookups.
    if (text.includes('refresh_tokens')) {
      if (text.includes('INSERT INTO refresh_tokens') && params) {
        const record = {
          id: `refresh-${this.nextRefreshTokenId++}`,
          user_id: params[0],
          token_hash: params[1],
          expires_at: params[2],
          revoked_at: null as Date | null,
        };
        this.refreshTokens.push(record);
        return { rows: [{ id: record.id }], rowCount: 1 };
      }

      if (text.includes('SELECT') && text.includes('WHERE token_hash =') && params) {
        const found = this.refreshTokens.find(t => t.token_hash === params[0]);
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
      }

      if (text.includes('UPDATE refresh_tokens') && params) {
        const matches = text.includes('WHERE token_hash = $1')
          ? this.refreshTokens.filter(t => t.token_hash === params[0])
          : this.refreshTokens.filter(t => t.id === params[0]);
        matches.forEach(t => { t.revoked_at = new Date(); });
        return { rows: [], rowCount: matches.length };
      }

      // CREATE TABLE / CREATE INDEX from ensureSchema, and anything else.
      return { rows: [], rowCount: 0 };
    }

    // Mock basic SQL queries for user operations
    if (text.includes('INSERT INTO users') && params) {
      const newUser: User = {
        id: `user-${this.nextId++}`,
        email: params[0],
        passwordHash: params[1],
        firstName: params[2],
        lastName: params[3],
        role: params[4] as UserRole,
        // Defaults to 'active' in UserModel; the mock has to supply it too or
        // the object no longer satisfies User.
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.users.push(newUser);
      return { rows: [this.mapUserToRow(newUser)], rowCount: 1 };
    }

    if (text.includes('SELECT') && text.includes('WHERE email =') && params) {
      const email = params[0];
      const user = this.users.find(u => u.email === email);
      return { rows: user ? [this.mapUserToRow(user)] : [], rowCount: user ? 1 : 0 };
    }

    if (text.includes('SELECT') && text.includes('WHERE id =') && params) {
      const id = params[0];
      const user = this.users.find(u => u.id === id);
      return { rows: user ? [this.mapUserToRow(user)] : [], rowCount: user ? 1 : 0 };
    }

    // Default empty result
    return { rows: [], rowCount: 0 };
  }

  override async transaction<T>(callback: any): Promise<T> {
    // Mock transaction - just call the callback
    return callback(this);
  }

  private mapUserToRow(user: User): any {
    return {
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  // Helper methods for testing
  clearUsers(): void {
    this.users = [];
    this.nextId = 1;
  }

  addUser(user: User): void {
    this.users.push(user);
  }

  getUsers(): User[] {
    return [...this.users];
  }
}