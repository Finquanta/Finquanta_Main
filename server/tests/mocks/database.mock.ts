import { Database } from '../../src/infrastructure/database';
import { User, UserRole } from '../../src/modules/users/types';

export class MockDatabase extends Database {
  private users: User[] = [];
  private nextId = 1;

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
    // Mock basic SQL queries for user operations
    if (text.includes('INSERT INTO users') && params) {
      const newUser: User = {
        id: `user-${this.nextId++}`,
        email: params[0],
        passwordHash: params[1],
        firstName: params[2],
        lastName: params[3],
        role: params[4] as UserRole,
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