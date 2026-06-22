import { Database } from '../../infrastructure/database';
import { User, CreateUserData, UpdateUserData, UserRole } from './types';
import { UserModel } from './user.model';

export class UserRepository {
  constructor(private database: Database) {}

  /** Add the columns used for password resets. Idempotent. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT`);
    await this.database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ`);
  }

  /** Store a hashed, expiring password-reset token for a user. */
  async setResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.database.query(
      `UPDATE users SET reset_token_hash = $2, reset_token_expires_at = $3, updated_at = NOW() WHERE id = $1`,
      [userId, tokenHash, expiresAt]
    );
  }

  /** Find a user by a still-valid reset token hash (returns null if expired/used). */
  async findByValidResetTokenHash(tokenHash: string): Promise<{ id: string; email: string } | null> {
    const result = await this.database.query(
      `SELECT id, email FROM users
       WHERE reset_token_hash = $1 AND reset_token_expires_at IS NOT NULL AND reset_token_expires_at > NOW()`,
      [tokenHash]
    );
    const r = result.rows[0];
    return r ? { id: r.id, email: r.email } : null;
  }

  /** Set a new password hash and clear any outstanding reset token (single-use). */
  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.database.query(
      `UPDATE users SET password_hash = $2, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = NOW() WHERE id = $1`,
      [userId, passwordHash]
    );
  }

  async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
    `;

    const result = await this.database.query(query, [
      userData.email,
      userData.passwordHash,
      userData.firstName,
      userData.lastName,
      userData.role
    ]);

    const user = this.mapRowToUser(result.rows[0]);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await this.database.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await this.database.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async update(id: string, updateData: UpdateUserData): Promise<User | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updateData.firstName !== undefined) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updateData.firstName);
    }

    if (updateData.lastName !== undefined) {
      setClause.push(`last_name = $${paramIndex++}`);
      values.push(updateData.lastName);
    }

    if (updateData.role !== undefined) {
      setClause.push(`role = $${paramIndex++}`);
      values.push(updateData.role);
    }

    if (updateData.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (setClause.length === 0) {
      // No updates to make
      return this.findById(id);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, password_hash, first_name, last_name, role, status, created_at, updated_at
    `;

    const result = await this.database.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.database.query(query, [id]);
    return result.rowCount > 0;
  }

  private mapRowToUser(row: any): User {
    return new UserModel({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role as UserRole,
      status: row.status ?? 'active',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }).toJSON();
  }
}