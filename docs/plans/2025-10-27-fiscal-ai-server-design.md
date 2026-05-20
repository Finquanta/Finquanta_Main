# Finquanta AI Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive Fastify TypeScript server with PostgreSQL + Redis to support both admin and user frontends for financial management.

**Architecture:** Modular monolith with clear separation of concerns, JWT authentication, WebSocket real-time features, and comprehensive API endpoints for financial transactions, payroll, user management, and admin operations.

**Tech Stack:** Fastify, TypeScript, PostgreSQL, Redis, JWT, WebSockets, bcrypt, pino, jest

---

## Implementation Overview

The server will be built using Test-Driven Development (TDD) with the following module structure:

```
server/src/
├── modules/
│   ├── auth/           # Authentication & authorization
│   ├── users/          # User management
│   ├── financial/      # Financial transactions & bookkeeping
│   ├── payroll/        # Payroll processing
│   ├── documents/      # File management
│   ├── admin/          # Admin-specific features
│   └── realtime/       # WebSocket & notifications
├── shared/             # Cross-cutting concerns
├── infrastructure/     # Database, cache, external services
└── api/               # API layer and routes
```

## Core Dependencies

First, we need to add all necessary dependencies:

### Task 1: Install Core Dependencies

**Files:**
- Modify: `server/package.json`

**Step 1: Add production dependencies**

```bash
cd server && pnpm add \
  @fastify/cors \
  @fastify/jwt \
  @fastify/websocket \
  @fastify/multipart \
  @fastify/rate-limit \
  pg \
  redis \
  bcrypt \
  joi \
  ws \
  fastify-plugin
```

**Step 2: Add development dependencies**

```bash
cd server && pnpm add -D \
  @types/pg \
  @types/bcrypt \
  @types/ws \
  @types/joi \
  jest \
  @types/jest \
  ts-jest \
  supertest \
  @types/supertest
```

**Step 3: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml
git commit -m "feat: add core server dependencies for PostgreSQL, Redis, JWT, WebSockets, and testing"
```

### Task 2: Configure Testing Framework

**Files:**
- Create: `server/jest.config.js`
- Modify: `server/package.json`

**Step 1: Write failing test for jest configuration**

Create `server/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

**Step 2: Add test script to package.json**

Modify `server/package.json` scripts section:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Step 3: Create test setup file**

Create `server/tests/setup.ts`:
```typescript
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
```

**Step 4: Run test to verify configuration**

```bash
cd server && npm test
```

Expected: PASS (no tests found but jest runs correctly)

**Step 5: Commit**

```bash
git add server/jest.config.js server/tests/setup.ts server/package.json
git commit -m "feat: configure jest testing framework with TypeScript support"
```

## Module 1: Authentication & Authorization

### Task 3: Database Connection and Configuration

**Files:**
- Create: `server/src/infrastructure/database.ts`
- Create: `server/src/infrastructure/redis.ts`
- Create: `server/tests/infrastructure/database.test.ts`

**Step 1: Write failing test for database connection**

Create `server/tests/infrastructure/database.test.ts`:
```typescript
import { Database } from '../../src/infrastructure/database';

describe('Database Connection', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database();
  });

  test('should connect to PostgreSQL successfully', async () => {
    await db.connect();
    expect(db.isConnected()).toBe(true);
    await db.disconnect();
  });

  test('should handle connection errors gracefully', async () => {
    const badDb = new Database({ connectionString: 'invalid' });
    await expect(bad.connect()).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/infrastructure/database.test.ts
```

Expected: FAIL with "Database class not found"

**Step 3: Implement minimal Database class**

Create `server/src/infrastructure/database.ts`:
```typescript
import { Pool, PoolClient } from 'pg';

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export class Database {
  private pool: Pool;
  private connected = false;

  constructor(config: DatabaseConfig = {}) {
    this.pool = new Pool({
      connectionString: config.connectionString || process.env.DATABASE_URL,
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || parseInt(process.env.DB_PORT || '5432'),
      database: config.database || process.env.DB_NAME || 'Finquanta_ai_test',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && npm test tests/infrastructure/database.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/infrastructure/database.ts server/tests/infrastructure/database.test.ts
git commit -m "feat: implement PostgreSQL database connection with tests"
```

### Task 4: Redis Connection

**Files:**
- Create: `server/src/infrastructure/redis.ts`
- Create: `server/tests/infrastructure/redis.test.ts`

**Step 1: Write failing test for Redis connection**

Create `server/tests/infrastructure/redis.test.ts`:
```typescript
import { RedisClient } from '../../src/infrastructure/redis';

describe('Redis Connection', () => {
  let redis: RedisClient;

  beforeEach(() => {
    redis = new RedisClient();
  });

  afterEach(async () => {
    await redis.disconnect();
  });

  test('should connect to Redis successfully', async () => {
    await redis.connect();
    expect(redis.isConnected()).toBe(true);
  });

  test('should set and get values', async () => {
    await redis.connect();
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    expect(value).toBe('test-value');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/infrastructure/redis.test.ts
```

Expected: FAIL with "RedisClient class not found"

**Step 3: Implement minimal RedisClient class**

Create `server/src/infrastructure/redis.ts`:
```typescript
import { createClient, RedisClientType } from 'redis';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  database?: number;
}

export class RedisClient {
  private client: RedisClientType;
  private connected = false;

  constructor(config: RedisConfig = {}) {
    this.client = createClient({
      url: config.url || process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        host: config.host || process.env.REDIS_HOST || 'localhost',
        port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      },
      password: config.password || process.env.REDIS_PASSWORD,
      database: config.database || parseInt(process.env.REDIS_DB || '0'),
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && npm test tests/infrastructure/redis.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/infrastructure/redis.ts server/tests/infrastructure/redis.test.ts
git commit -m "feat: implement Redis client with connection management and tests"
```

## Module 2: Authentication System

### Task 5: JWT Token Management

**Files:**
- Create: `server/src/modules/auth/jwt.ts`
- Create: `server/tests/modules/auth/jwt.test.ts`

**Step 1: Write failing test for JWT token generation and verification**

Create `server/tests/modules/auth/jwt.test.ts`:
```typescript
import { JWTManager } from '../../src/modules/auth/jwt';

describe('JWT Manager', () => {
  let jwtManager: JWTManager;

  beforeEach(() => {
    jwtManager = new JWTManager('test-secret-key');
  });

  test('should generate and verify access token', () => {
    const payload = { userId: '123', email: 'test@example.com', role: 'user' };
    const token = jwtManager.generateAccessToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwtManager.verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  test('should generate and verify refresh token', () => {
    const payload = { userId: '123' };
    const token = jwtManager.generateRefreshToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwtManager.verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  test('should reject invalid tokens', () => {
    const invalidToken = 'invalid.token.here';

    expect(() => jwtManager.verifyAccessToken(invalidToken)).toThrow();
    expect(() => jwtManager.verifyRefreshToken(invalidToken)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/auth/jwt.test.ts
```

Expected: FAIL with "JWTManager class not found"

**Step 3: Implement JWTManager class**

Create `server/src/modules/auth/jwt.ts`:
```typescript
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export class JWTManager {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor(secretKey: string) {
    this.accessSecret = secretKey;
    this.refreshSecret = secretKey + '-refresh';
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
  }

  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'Finquanta-ai',
      audience: 'Finquanta-ai-client',
    });
  }

  generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'Finquanta-ai',
      audience: 'Finquanta-ai-client',
    });
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.accessSecret, {
        issuer: 'Finquanta-ai',
        audience: 'Finquanta-ai-client',
      }) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'Finquanta-ai',
        audience: 'Finquanta-ai-client',
      }) as RefreshTokenPayload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && npm test tests/modules/auth/jwt.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/modules/auth/jwt.ts server/tests/modules/auth/jwt.test.ts
git commit -m "feat: implement JWT token management with access and refresh tokens"
```

### Task 6: Password Hashing

**Files:**
- Create: `server/src/modules/auth/password.ts`
- Create: `server/tests/modules/auth/password.test.ts`

**Step 1: Write failing test for password hashing and verification**

Create `server/tests/modules/auth/password.test.ts`:
```typescript
import { PasswordManager } from '../../src/modules/auth/password';

describe('Password Manager', () => {
  let passwordManager: PasswordManager;

  beforeEach(() => {
    passwordManager = new PasswordManager();
  });

  test('should hash password and verify correct password', async () => {
    const password = 'securePassword123!';
    const hash = await passwordManager.hash(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);

    const isValid = await passwordManager.verify(password, hash);
    expect(isValid).toBe(true);
  });

  test('should reject incorrect password', async () => {
    const password = 'securePassword123!';
    const wrongPassword = 'wrongPassword456!';
    const hash = await passwordManager.hash(password);

    const isValid = await passwordManager.verify(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  test('should handle edge cases', async () => {
    const emptyPassword = '';
    const hash = await passwordManager.hash(emptyPassword);

    expect(hash).toBeDefined();
    expect(await passwordManager.verify(emptyPassword, hash)).toBe(true);
    expect(await passwordManager.verify('not-empty', hash)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/auth/password.test.ts
```

Expected: FAIL with "PasswordManager class not found"

**Step 3: Implement PasswordManager class**

Create `server/src/modules/auth/password.ts`:
```typescript
import bcrypt from 'bcrypt';

export class PasswordManager {
  private readonly saltRounds = 12;

  async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && npm test tests/modules/auth/password.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/modules/auth/password.ts server/tests/modules/auth/password.test.ts
git commit -m "feat: implement secure password hashing with bcrypt"
```

## Module 3: User Management

### Task 7: User Model and Repository

**Files:**
- Create: `server/src/modules/users/types.ts`
- Create: `server/src/modules/users/user.model.ts`
- Create: `server/src/modules/users/user.repository.ts`
- Create: `server/tests/modules/users/user.repository.test.ts`

**Step 1: Write failing test for user repository**

Create `server/tests/modules/users/user.repository.test.ts`:
```typescript
import { Database } from '../../../src/infrastructure/database';
import { UserRepository } from '../../../src/modules/users/user.repository';
import { UserRole } from '../../../src/modules/users/types';

describe('User Repository', () => {
  let db: Database;
  let userRepository: UserRepository;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    userRepository = new UserRepository(db);

    // Create users table for testing
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    await db.query('DROP TABLE IF EXISTS users');
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM users');
  });

  test('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.USER,
      passwordHash: 'hashedpassword123',
    };

    const user = await userRepository.create(userData);

    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.role).toBe(userData.role);
    expect(user.passwordHash).toBe(userData.passwordHash);
    expect(user.createdAt).toBeDefined();
  });

  test('should find user by email', async () => {
    const userData = {
      email: 'find@example.com',
      name: 'Find User',
      role: UserRole.USER,
      passwordHash: 'hashedpassword123',
    };

    const createdUser = await userRepository.create(userData);
    const foundUser = await userRepository.findByEmail(userData.email);

    expect(foundUser).toBeDefined();
    expect(foundUser!.id).toBe(createdUser.id);
    expect(foundUser!.email).toBe(userData.email);
  });

  test('should return null when user not found by email', async () => {
    const user = await userRepository.findByEmail('nonexistent@example.com');
    expect(user).toBeNull();
  });

  test('should find user by ID', async () => {
    const userData = {
      email: 'findbyid@example.com',
      name: 'Find By ID User',
      role: UserRole.USER,
      passwordHash: 'hashedpassword123',
    };

    const createdUser = await userRepository.create(userData);
    const foundUser = await userRepository.findById(createdUser.id);

    expect(foundUser).toBeDefined();
    expect(foundUser!.id).toBe(createdUser.id);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/users/user.repository.test.ts
```

Expected: FAIL with missing type definitions and repository class

**Step 3: Implement user types and repository**

Create `server/src/modules/users/types.ts`:
```typescript
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  avatarUrl?: string;
}

export interface UpdateUserData {
  name?: string;
  role?: UserRole;
  avatarUrl?: string;
}
```

Create `server/src/modules/users/user.model.ts`:
```typescript
import { User, UserRole, CreateUserData } from './types';

export class User implements User {
  public readonly id: string;
  public readonly email: string;
  public name: string;
  public role: UserRole;
  public readonly passwordHash: string;
  public avatarUrl?: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(data: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    passwordHash: string;
    avatarUrl?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.email = data.email;
    this.name = data.name;
    this.role = data.role;
    this.passwordHash = data.passwordHash;
    this.avatarUrl = data.avatarUrl;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static create(data: CreateUserData & { id: string }): User {
    return new User({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  update(data: Partial<Pick<User, 'name' | 'role' | 'avatarUrl'>>): User {
    return new User({
      ...this,
      ...data,
      updatedAt: new Date(),
    });
  }
}
```

Create `server/src/modules/users/user.repository.ts`:
```typescript
import { Database } from '../../infrastructure/database';
import { User, CreateUserData, UpdateUserData, UserRole } from './types';

export class UserRepository {
  constructor(private db: Database) {}

  async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (email, name, role, password_hash, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, password_hash, avatar_url, created_at, updated_at
    `;

    const result = await this.db.query(query, [
      userData.email,
      userData.name,
      userData.role,
      userData.passwordHash,
      userData.avatarUrl || null,
    ]);

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, role, password_hash, avatar_url, created_at, updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, name, role, password_hash, avatar_url, created_at, updated_at
      FROM users
      WHERE email = $1
    `;

    const result = await this.db.query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(id: string, userData: UpdateUserData): Promise<User | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (userData.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(userData.name);
    }

    if (userData.role !== undefined) {
      fields.push(`role = $${paramIndex++}`);
      values.push(userData.role);
    }

    if (userData.avatarUrl !== undefined) {
      fields.push(`avatar_url = $${paramIndex++}`);
      values.push(userData.avatarUrl);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, role, password_hash, avatar_url, created_at, updated_at
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      passwordHash: row.password_hash,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    return result.rowCount > 0;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd server && npm test tests/modules/users/user.repository.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add server/src/modules/users/types.ts server/src/modules/users/user.model.ts server/src/modules/users/user.repository.ts server/tests/modules/users/user.repository.test.ts
git commit -m "feat: implement user model and repository with full CRUD operations"
```

## Module 4: Authentication Routes

### Task 8: Authentication Controller and Routes

**Files:**
- Create: `server/src/modules/auth/auth.controller.ts`
- Create: `server/src/modules/auth/auth.service.ts`
- Create: `server/src/modules/auth/auth.routes.ts`
- Create: `server/tests/modules/auth/auth.controller.test.ts`

**Step 1: Write failing test for authentication controller**

Create `server/tests/modules/auth/auth.controller.test.ts`:
```typescript
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server';
import { Database } from '../../src/infrastructure/database';
import { UserRepository } from '../../src/modules/users/user.repository';
import { UserRole } from '../../src/modules/users/types';

describe('Authentication Controller', () => {
  let app: FastifyInstance;
  let db: Database;
  let userRepository: UserRepository;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    userRepository = new UserRepository(db);

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.query('DROP TABLE IF EXISTS users');
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM users');
  });

  test('should register a new user', async () => {
    const userData = {
      email: 'register@example.com',
      name: 'Register User',
      password: 'securePassword123!',
    };

    const response = await request(app.server)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: {
          email: userData.email,
          name: userData.name,
          role: UserRole.USER,
        },
      },
    });
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();
  });

  test('should login with valid credentials', async () => {
    // Create a user first
    const userData = {
      email: 'login@example.com',
      name: 'Login User',
      password: 'securePassword123!',
    };

    await request(app.server)
      .post('/api/v1/auth/register')
      .send(userData);

    // Now login
    const loginResponse = await request(app.server)
      .post('/api/v1/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      success: true,
      data: {
        user: {
          email: userData.email,
          name: userData.name,
        },
      },
    });
    expect(loginResponse.body.data.accessToken).toBeDefined();
    expect(loginResponse.body.data.refreshToken).toBeDefined();
  });

  test('should reject invalid credentials', async () => {
    const response = await request(app.server)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid credentials',
    });
  });

  test('should reject duplicate email registration', async () => {
    const userData = {
      email: 'duplicate@example.com',
      name: 'Duplicate User',
      password: 'securePassword123!',
    };

    // Register first time
    await request(app.server)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);

    // Try to register again
    const response = await request(app.server)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Email already registered',
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/auth/auth.controller.test.ts
```

Expected: FAIL with missing authentication controller, service, and routes

**Step 3: Implement authentication service**

Create `server/src/modules/auth/auth.service.ts`:
```typescript
import { UserRepository } from '../users/user.repository';
import { JWTManager } from './jwt';
import { PasswordManager } from './password';
import { UserRole } from '../users/types';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatarUrl?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private jwtManager: JWTManager;
  private passwordManager: PasswordManager;

  constructor(private userRepository: UserRepository) {
    this.jwtManager = new JWTManager(process.env.JWT_SECRET || 'default-secret');
    this.passwordManager = new PasswordManager();
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await this.passwordManager.hash(data.password);

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      name: data.name,
      role: UserRole.USER,
      passwordHash,
    });

    // Generate tokens
    const accessToken = this.jwtManager.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = this.jwtManager.generateRefreshToken({
      userId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.passwordManager.verify(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.jwtManager.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = this.jwtManager.generateRefreshToken({
      userId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = this.jwtManager.verifyRefreshToken(refreshToken);
      const user = await this.userRepository.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      const newAccessToken = this.jwtManager.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}
```

**Step 4: Implement authentication controller**

Create `server/src/modules/auth/auth.controller.ts`:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, LoginData, RegisterData } from './auth.service';

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userData = request.body as RegisterData;

      // Basic validation
      if (!userData.email || !userData.name || !userData.password) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields',
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid email format',
        });
      }

      // Password validation
      if (userData.password.length < 8) {
        return reply.status(400).send({
          success: false,
          error: 'Password must be at least 8 characters long',
        });
      }

      const result = await this.authService.register(userData);

      return reply.status(201).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Email already registered') {
          return reply.status(409).send({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const loginData = request.body as LoginData;

      if (!loginData.email || !loginData.password) {
        return reply.status(400).send({
          success: false,
          error: 'Email and password are required',
        });
      }

      const result = await this.authService.login(loginData);

      return reply.send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return reply.status(401).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = request.body as { refreshToken: string };

      if (!refreshToken) {
        return reply.status(400).send({
          success: false,
          error: 'Refresh token is required',
        });
      }

      const result = await this.authService.refreshToken(refreshToken);

      return reply.send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid refresh token') {
        return reply.status(401).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

**Step 5: Implement authentication routes**

Create `server/src/modules/auth/auth.routes.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from '../users/user.repository';
import { Database } from '../../infrastructure/database';

export default async function authRoutes(fastify: FastifyInstance) {
  const db = new Database();
  await db.connect();

  const userRepository = new UserRepository(db);
  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);

  // Register schema definitions
  const registerSchema = {
    body: {
      type: 'object',
      required: ['email', 'name', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 1 },
        password: { type: 'string', minLength: 8 },
      },
    },
  };

  const loginSchema = {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
    },
  };

  const refreshTokenSchema = {
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string' },
      },
    },
  };

  // Register routes
  fastify.post('/register', {
    schema: registerSchema,
  }, authController.register.bind(authController));

  fastify.post('/login', {
    schema: loginSchema,
  }, authController.login.bind(authController));

  fastify.post('/refresh', {
    schema: refreshTokenSchema,
  }, authController.refreshToken.bind(authController));
}
```

**Step 6: Update main server to include auth routes**

Update `server/src/server.ts`:
```typescript
import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/config';
import authRoutes from './modules/auth/auth.routes';

const server: FastifyInstance = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.isDevelopment ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register CORS
server.register(require('@fastify/cors'), {
  origin: config.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// Register routes
server.register(authRoutes, { prefix: '/api/v1/auth' });

// Start server
const start = async (): Promise<void> => {
  try {
    const port = Number(config.PORT) || 3001;
    const host = config.HOST || '0.0.0.0';

    await server.listen({ port, host });
    server.log.info(`🚀 Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  server.log.info('📴 Received SIGINT, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  server.log.info('📴 Received SIGTERM, shutting down gracefully...');
  await server.close();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  server.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  server.log.error('Uncaught Exception:', error);
  process.exit(1);
});

export { server, start };
```

**Step 7: Update buildServer function for tests**

Create `server/src/tests/server.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { server } from '../server';

export function buildServer(): FastifyInstance {
  return server;
}
```

**Step 8: Run test to verify it passes**

```bash
cd server && npm test tests/modules/auth/auth.controller.test.ts
```

Expected: PASS

**Step 9: Commit**

```bash
git add server/src/modules/auth/ server/src/tests/server.ts server/src/server.ts
git commit -m "feat: implement complete authentication system with registration, login, and token refresh"
```

## Module 5: Financial Transactions

### Task 9: Financial Transaction System

**Files:**
- Create: `server/src/modules/financial/types.ts`
- Create: `server/src/modules/financial/transaction.repository.ts`
- Create: `server/src/modules/financial/transaction.service.ts`
- Create: `server/src/modules/financial/transaction.routes.ts`
- Create: `server/tests/modules/financial/transaction.test.ts`

**Step 1: Write failing test for financial transactions**

Create `server/tests/modules/financial/transaction.test.ts`:
```typescript
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/tests/server';
import { Database } from '../../src/infrastructure/database';
import { UserRepository } from '../../src/modules/users/user.repository';
import { UserRole } from '../../src/modules/users/types';

describe('Financial Transactions', () => {
  let app: FastifyInstance;
  let db: Database;
  let userRepository: UserRepository;
  let authToken: string;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
    userRepository = new UserRepository(db);

    // Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        invoice VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    app = buildServer();
    await app.ready();

    // Create and login test user
    const registerResponse = await request(app.server)
      .post('/api/v1/auth/register')
      .send({
        email: 'financial@example.com',
        name: 'Financial User',
        password: 'securePassword123!',
      });

    authToken = registerResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await db.query('DROP TABLE IF EXISTS financial_transactions');
    await db.query('DROP TABLE IF EXISTS users');
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM financial_transactions');
  });

  test('should create a new income transaction', async () => {
    const transactionData = {
      type: 'income',
      category: 'Services',
      amount: 1500.00,
      description: 'Web design project',
      date: '2025-01-15',
      invoice: 'INV-001',
    };

    const response = await request(app.server)
      .post('/api/v1/financial/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(transactionData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        type: 'income',
        category: 'Services',
        amount: '1500.00',
        description: 'Web design project',
        status: 'completed',
      },
    });
    expect(response.body.data.id).toBeDefined();
  });

  test('should create a new expense transaction', async () => {
    const transactionData = {
      type: 'expense',
      category: 'Utilities',
      amount: 250.00,
      description: 'Electric bill',
      date: '2025-01-15',
    };

    const response = await request(app.server)
      .post('/api/v1/financial/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(transactionData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        type: 'expense',
        category: 'Utilities',
        amount: '250.00',
        description: 'Electric bill',
        status: 'completed',
      },
    });
  });

  test('should list all user transactions', async () => {
    // Create multiple transactions
    const transactions = [
      {
        type: 'income',
        category: 'Services',
        amount: 1000.00,
        description: 'Consulting',
        date: '2025-01-10',
      },
      {
        type: 'expense',
        category: 'Rent',
        amount: 800.00,
        description: 'Office rent',
        date: '2025-01-05',
      },
    ];

    for (const transaction of transactions) {
      await request(app.server)
        .post('/api/v1/financial/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transaction);
    }

    const response = await request(app.server)
      .get('/api/v1/financial/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.transactions).toHaveLength(2);
    expect(response.body.data.summary).toBeDefined();
    expect(response.body.data.summary.totalIncome).toBe('1000.00');
    expect(response.body.data.summary.totalExpenses).toBe('800.00');
    expect(response.body.data.summary.balance).toBe('200.00');
  });

  test('should require authentication', async () => {
    const response = await request(app.server)
      .post('/api/v1/financial/transactions')
      .send({
        type: 'income',
        category: 'Services',
        amount: 1000.00,
        description: 'Test transaction',
        date: '2025-01-15',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Missing authentication',
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/financial/transaction.test.ts
```

Expected: FAIL with missing financial module

**Step 3: Implement financial types and repository**

Create `server/src/modules/financial/types.ts`:
```typescript
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface FinancialTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  date: Date;
  invoice?: string;
  status: TransactionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionData {
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  date: string;
  invoice?: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
}

export interface TransactionListResponse {
  transactions: FinancialTransaction[];
  summary: TransactionSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

Create `server/src/modules/financial/transaction.repository.ts`:
```typescript
import { Database } from '../../infrastructure/database';
import { FinancialTransaction, CreateTransactionData, TransactionType, TransactionStatus } from './types';

export class TransactionRepository {
  constructor(private db: Database) {}

  async create(userId: string, data: CreateTransactionData): Promise<FinancialTransaction> {
    const query = `
      INSERT INTO financial_transactions
      (user_id, type, category, amount, description, date, invoice, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, type, category, amount, description, date, invoice, status, created_at, updated_at
    `;

    const result = await this.db.query(query, [
      userId,
      data.type,
      data.category,
      data.amount,
      data.description || null,
      data.date,
      data.invoice || null,
      TransactionStatus.COMPLETED,
    ]);

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as TransactionType,
      category: row.category,
      amount: parseFloat(row.amount),
      description: row.description,
      date: row.date,
      invoice: row.invoice,
      status: row.status as TransactionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByUserId(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      category?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{ transactions: FinancialTransaction[]; total: number }> {
    const { page = 1, limit = 50, type, category, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      queryParams.push(type);
    }

    if (category) {
      whereClause += ` AND category = $${paramIndex++}`;
      queryParams.push(category);
    }

    if (startDate) {
      whereClause += ` AND date >= $${paramIndex++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND date <= $${paramIndex++}`;
      queryParams.push(endDate);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM financial_transactions ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get transactions with pagination
    const dataQuery = `
      SELECT id, user_id, type, category, amount, description, date, invoice, status, created_at, updated_at
      FROM financial_transactions
      ${whereClause}
      ORDER BY date DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, queryParams);

    const transactions = dataResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type as TransactionType,
      category: row.category,
      amount: parseFloat(row.amount),
      description: row.description,
      date: row.date,
      invoice: row.invoice,
      status: row.status as TransactionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { transactions, total };
  }

  async findById(id: string, userId: string): Promise<FinancialTransaction | null> {
    const query = `
      SELECT id, user_id, type, category, amount, description, date, invoice, status, created_at, updated_at
      FROM financial_transactions
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as TransactionType,
      category: row.category,
      amount: parseFloat(row.amount),
      description: row.description,
      date: row.date,
      invoice: row.invoice,
      status: row.status as TransactionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(id: string, userId: string, data: Partial<CreateTransactionData>): Promise<FinancialTransaction | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }

    if (data.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }

    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.date !== undefined) {
      fields.push(`date = $${paramIndex++}`);
      values.push(data.date);
    }

    if (data.invoice !== undefined) {
      fields.push(`invoice = $${paramIndex++}`);
      values.push(data.invoice);
    }

    if (fields.length === 0) {
      return this.findById(id, userId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, userId);

    const query = `
      UPDATE financial_transactions
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING id, user_id, type, category, amount, description, date, invoice, status, created_at, updated_at
    `;

    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type as TransactionType,
      category: row.category,
      amount: parseFloat(row.amount),
      description: row.description,
      date: row.date,
      invoice: row.invoice,
      status: row.status as TransactionStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2';
    const result = await this.db.query(query, [id, userId]);
    return result.rowCount > 0;
  }

  async getSummary(userId: string, options: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  }> {
    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (options.startDate) {
      whereClause += ` AND date >= $${paramIndex++}`;
      queryParams.push(options.startDate);
    }

    if (options.endDate) {
      whereClause += ` AND date <= $${paramIndex++}`;
      queryParams.push(options.endDate);
    }

    const query = `
      SELECT
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM financial_transactions
      ${whereClause}
      GROUP BY type
    `;

    const result = await this.db.query(query, queryParams);

    let totalIncome = 0;
    let totalExpenses = 0;
    let transactionCount = 0;

    for (const row of result.rows) {
      transactionCount += parseInt(row.count);
      if (row.type === TransactionType.INCOME) {
        totalIncome = parseFloat(row.total) || 0;
      } else if (row.type === TransactionType.EXPENSE) {
        totalExpenses = parseFloat(row.total) || 0;
      }
    }

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      transactionCount,
    };
  }
}
```

**Step 4: Implement transaction service**

Create `server/src/modules/financial/transaction.service.ts`:
```typescript
import { TransactionRepository } from './transaction.repository';
import { CreateTransactionData, FinancialTransaction, TransactionListResponse, TransactionType } from './types';

export class TransactionService {
  constructor(private transactionRepository: TransactionRepository) {}

  async createTransaction(userId: string, data: CreateTransactionData): Promise<FinancialTransaction> {
    // Validation
    if (data.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (!Object.values(TransactionType).includes(data.type)) {
      throw new Error('Invalid transaction type');
    }

    if (!data.category || data.category.trim().length === 0) {
      throw new Error('Category is required');
    }

    if (!data.date) {
      throw new Error('Date is required');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    return await this.transactionRepository.create(userId, data);
  }

  async getTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      category?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<TransactionListResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));

    const { transactions, total } = await this.transactionRepository.findByUserId(userId, {
      page,
      limit,
      type: options.type,
      category: options.category,
      startDate: options.startDate,
      endDate: options.endDate,
    });

    const summary = await this.transactionRepository.getSummary(userId, {
      startDate: options.startDate,
      endDate: options.endDate,
    });

    return {
      transactions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransaction(userId: string, transactionId: string): Promise<FinancialTransaction | null> {
    return await this.transactionRepository.findById(transactionId, userId);
  }

  async updateTransaction(
    userId: string,
    transactionId: string,
    data: Partial<CreateTransactionData>
  ): Promise<FinancialTransaction | null> {
    if (data.amount !== undefined && data.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (data.type !== undefined && !Object.values(TransactionType).includes(data.type)) {
      throw new Error('Invalid transaction type');
    }

    if (data.category !== undefined && data.category.trim().length === 0) {
      throw new Error('Category cannot be empty');
    }

    if (data.date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.date)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }
    }

    return await this.transactionRepository.update(transactionId, userId, data);
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
    return await this.transactionRepository.delete(transactionId, userId);
  }

  async getCategories(userId: string): Promise<string[]> {
    const result = await this.transactionRepository.findByUserId(userId, { limit: 1000 });
    const categories = new Set<string>();

    result.transactions.forEach(transaction => {
      categories.add(transaction.category);
    });

    return Array.from(categories).sort();
  }
}
```

**Step 5: Implement transaction controller and routes**

Create `server/src/modules/financial/transaction.controller.ts`:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from './transaction.service';
import { CreateTransactionData, TransactionType } from './types';

export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  async createTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const transactionData = request.body as CreateTransactionData;
      const transaction = await this.transactionService.createTransaction(userId, transactionData);

      return reply.status(201).send({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getTransactions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const query = request.query as any;
      const options = {
        page: parseInt(query.page) || undefined,
        limit: parseInt(query.limit) || undefined,
        type: query.type as TransactionType | undefined,
        category: query.category as string | undefined,
        startDate: query.startDate as string | undefined,
        endDate: query.endDate as string | undefined,
      };

      const result = await this.transactionService.getTransactions(userId, options);

      return reply.send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const { id } = request.params as { id: string };
      const transaction = await this.transactionService.getTransaction(userId, id);

      if (!transaction) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async updateTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const { id } = request.params as { id: string };
      const updateData = request.body as Partial<CreateTransactionData>;

      const transaction = await this.transactionService.updateTransaction(userId, id, updateData);

      if (!transaction) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const { id } = request.params as { id: string };
      const deleted = await this.transactionService.deleteTransaction(userId, id);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Transaction not found',
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(204).send();
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getCategories(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
          timestamp: new Date().toISOString(),
        });
      }

      const categories = await this.transactionService.getCategories(userId);

      return reply.send({
        success: true,
        data: { categories },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

Create `server/src/modules/financial/transaction.routes.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { Database } from '../../infrastructure/database';

export default async function transactionRoutes(fastify: FastifyInstance) {
  const db = new Database();
  await db.connect();

  const transactionRepository = new TransactionRepository(db);
  const transactionService = new TransactionService(transactionRepository);
  const transactionController = new TransactionController(transactionService);

  // Add authentication hook
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authentication',
        });
      }

      // Verify JWT token (simplified for now - we'll implement proper JWT verification in auth middleware)
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      (request as any).user = decoded;
    } catch (error) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid authentication token',
      });
    }
  });

  // Route schemas
  const createTransactionSchema = {
    body: {
      type: 'object',
      required: ['type', 'category', 'amount', 'date'],
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string', minLength: 1 },
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
        date: { type: 'string', format: 'date' },
        invoice: { type: 'string' },
      },
    },
  };

  const querySchema = {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string', pattern: '^[0-9]+$' },
        limit: { type: 'string', pattern: '^[0-9]+$' },
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string' },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
      },
    },
  };

  const updateTransactionSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
    body: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        category: { type: 'string', minLength: 1 },
        amount: { type: 'number', minimum: 0.01 },
        description: { type: 'string' },
        date: { type: 'string', format: 'date' },
        invoice: { type: 'string' },
      },
    },
  };

  const deleteTransactionSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
      },
    },
  };

  // Routes
  fastify.post('/transactions', {
    schema: createTransactionSchema,
  }, transactionController.createTransaction.bind(transactionController));

  fastify.get('/transactions', {
    schema: querySchema,
  }, transactionController.getTransactions.bind(transactionController));

  fastify.get('/transactions/:id', {
    schema: deleteTransactionSchema,
  }, transactionController.getTransaction.bind(transactionController));

  fastify.put('/transactions/:id', {
    schema: updateTransactionSchema,
  }, transactionController.updateTransaction.bind(transactionController));

  fastify.delete('/transactions/:id', {
    schema: deleteTransactionSchema,
  }, transactionController.deleteTransaction.bind(transactionController));

  fastify.get('/categories', {}, transactionController.getCategories.bind(transactionController));
}
```

**Step 6: Update server to include financial routes**

Update `server/src/server.ts`:
```typescript
import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/config';
import authRoutes from './modules/auth/auth.routes';
import financialRoutes from './modules/financial/transaction.routes';

const server: FastifyInstance = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.isDevelopment ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register CORS
server.register(require('@fastify/cors'), {
  origin: config.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// Register routes
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(financialRoutes, { prefix: '/api/v1/financial' });

// Keep existing routes...
// ... rest of the server.ts file remains the same
```

**Step 7: Run test to verify it passes**

```bash
cd server && npm test tests/modules/financial/transaction.test.ts
```

Expected: PASS

**Step 8: Commit**

```bash
git add server/src/modules/financial/ server/src/server.ts
git commit -m "feat: implement complete financial transaction system with CRUD operations and authentication"
```

## Module 6: Real-time Features

### Task 10: WebSocket Implementation

**Files:**
- Create: `server/src/modules/realtime/websocket.ts`
- Create: `server/src/modules/realtime/notification.service.ts`
- Create: `server/tests/modules/realtime/websocket.test.ts`

**Step 1: Write failing test for WebSocket connections**

Create `server/tests/modules/realtime/websocket.test.ts`:
```typescript
import WebSocket from 'ws';
import { buildServer } from '../../src/tests/server';

describe('WebSocket Real-time Features', () => {
  let server: any;
  let wsUrl: string;

  beforeAll(async () => {
    const app = buildServer();
    await app.listen({ port: 0 }); // Random available port
    const address = app.server.address();
    wsUrl = `ws://localhost:${address.port}/ws`;
    server = app;
  });

  afterAll(async () => {
    await server.close();
  });

  test('should establish WebSocket connection', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    ws.on('close', () => {
      done();
    });
  });

  test('should handle authentication via WebSocket', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      // Send authentication message
      ws.send(JSON.stringify({
        type: 'auth',
        token: 'valid-jwt-token'
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'auth_response') {
        expect(message.success).toBe(true);
        ws.close();
      }
    });

    ws.on('close', () => {
      done();
    });
  });

  test('should broadcast notifications to authenticated users', (done) => {
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);
    let authCount = 0;

    const checkAuth = () => {
      authCount++;
      if (authCount === 2) {
        // Both clients authenticated, send notification
        ws1.send(JSON.stringify({
          type: 'test_notification',
          data: { message: 'Test broadcast' }
        }));
      }
    };

    ws1.on('open', () => {
      ws1.send(JSON.stringify({
        type: 'auth',
        token: 'valid-jwt-token'
      }));
    });

    ws2.on('open', () => {
      ws2.send(JSON.stringify({
        type: 'auth',
        token: 'valid-jwt-token-2'
      }));
    });

    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'auth_response') {
        checkAuth();
      } else if (message.type === 'notification') {
        expect(message.data.message).toBe('Test broadcast');
        ws1.close();
        ws2.close();
      }
    });

    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'auth_response') {
        checkAuth();
      }
    });

    ws1.on('close', () => {
      done();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd server && npm test tests/modules/realtime/websocket.test.ts
```

Expected: FAIL with missing WebSocket implementation

**Step 3: Implement WebSocket functionality**

Create `server/src/modules/realtime/websocket.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { NotificationService } from './notification.service';

export interface WSMessage {
  type: string;
  data?: any;
  userId?: string;
  timestamp: string;
}

export interface WSClient {
  ws: WebSocket;
  userId?: string;
  isAuthenticated: boolean;
  lastActivity: Date;
}

export class WebSocketManager {
  private clients = new Map<WebSocket, WSClient>();
  private userClients = new Map<string, Set<WebSocket>>();
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  handleConnection(ws: WebSocket, request: any, server: FastifyInstance) {
    const client: WSClient = {
      ws,
      isAuthenticated: false,
      lastActivity: new Date(),
    };

    this.clients.set(ws, client);

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await this.handleMessage(client, message, server);
      } catch (error) {
        this.sendError(client, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(client);
    });

    ws.on('pong', () => {
      client.lastActivity = new Date();
    });

    // Send welcome message
    this.sendMessage(client, {
      type: 'welcome',
      data: { message: 'Connected to Finquanta AI real-time updates' },
      timestamp: new Date().toISOString(),
    });

    // Start ping interval to detect dead connections
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  private async handleMessage(client: WSClient, message: WSMessage, server: FastifyInstance) {
    client.lastActivity = new Date();

    switch (message.type) {
      case 'auth':
        await this.handleAuthentication(client, message, server);
        break;

      case 'subscribe':
        this.handleSubscription(client, message);
        break;

      case 'unsubscribe':
        this.handleUnsubscription(client, message);
        break;

      case 'ping':
        this.sendMessage(client, {
          type: 'pong',
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        this.sendError(client, 'Unknown message type');
    }
  }

  private async handleAuthentication(client: WSClient, message: WSMessage, server: FastifyInstance) {
    try {
      if (!message.data?.token) {
        this.sendError(client, 'Missing authentication token');
        return;
      }

      // Verify JWT token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(message.data.token, process.env.JWT_SECRET || 'default-secret');

      client.userId = decoded.userId;
      client.isAuthenticated = true;

      // Add to user clients map
      if (!this.userClients.has(decoded.userId)) {
        this.userClients.set(decoded.userId, new Set());
      }
      this.userClients.get(decoded.userId)!.add(client.ws);

      this.sendMessage(client, {
        type: 'auth_response',
        data: {
          success: true,
          userId: decoded.userId,
        },
        timestamp: new Date().toISOString(),
      });

      // Send pending notifications
      const pendingNotifications = await this.notificationService.getPendingNotifications(decoded.userId);
      for (const notification of pendingNotifications) {
        this.sendMessage(client, {
          type: 'notification',
          data: notification,
          timestamp: new Date().toISOString(),
        });
      }

      // Mark notifications as delivered
      await this.notificationService.markAsDelivered(pendingNotifications.map(n => n.id));
    } catch (error) {
      this.sendMessage(client, {
        type: 'auth_response',
        data: { success: false, error: 'Invalid token' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleSubscription(client: WSClient, message: WSMessage) {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }

    // Handle subscription to specific channels
    // Implementation depends on requirements
    this.sendMessage(client, {
      type: 'subscription_response',
      data: { success: true, channel: message.data?.channel },
      timestamp: new Date().toISOString(),
    });
  }

  private handleUnsubscription(client: WSClient, message: WSMessage) {
    if (!client.isAuthenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }

    // Handle unsubscription from channels
    this.sendMessage(client, {
      type: 'unsubscription_response',
      data: { success: true, channel: message.data?.channel },
      timestamp: new Date().toISOString(),
    });
  }

  private handleDisconnection(client: WSClient) {
    this.clients.delete(client.ws);

    if (client.userId && this.userClients.has(client.userId)) {
      this.userClients.get(client.userId)!.delete(client.ws);
      if (this.userClients.get(client.userId)!.size === 0) {
        this.userClients.delete(client.userId);
      }
    }
  }

  sendMessage(client: WSClient, message: WSMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  sendError(client: WSClient, error: string) {
    this.sendMessage(client, {
      type: 'error',
      data: { error },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToUser(userId: string, message: WSMessage) {
    const clients = this.userClients.get(userId);
    if (clients) {
      for (const ws of clients) {
        const client = this.clients.get(ws);
        if (client && client.isAuthenticated) {
          this.sendMessage(client, message);
        }
      }
    }
  }

  broadcastToAll(message: WSMessage) {
    for (const client of this.clients.values()) {
      if (client.isAuthenticated) {
        this.sendMessage(client, message);
      }
    }
  }

  broadcastToRole(role: string, message: WSMessage) {
    for (const client of this.clients.values()) {
      if (client.isAuthenticated && client.userId) {
        // Check user role - this would require database lookup
        // For now, broadcast to all authenticated users
        this.sendMessage(client, message);
      }
    }
  }
}
```

Create `server/src/modules/realtime/notification.service.ts`:
```typescript
import { Database } from '../../infrastructure/database';

export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: Date;
  readAt?: Date;
  deliveredAt?: Date;
}

export interface CreateNotificationData {
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  constructor(private db?: Database) {}

  async createNotification(data: CreateNotificationData): Promise<Notification> {
    if (!this.db) {
      throw new Error('Database not configured');
    }

    // Ensure notifications table exists
    await this.ensureNotificationsTable();

    const query = `
      INSERT INTO notifications (user_id, type, title, message, data, is_read, is_delivered)
      VALUES ($1, $2, $3, $4, $5, false, false)
      RETURNING id, user_id, type, title, message, data, is_read, is_delivered, created_at, read_at, delivered_at
    `;

    const result = await this.db.query(query, [
      data.userId,
      data.type,
      data.title,
      data.message,
      data.data ? JSON.stringify(data.data) : null,
    ]);

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      isRead: row.is_read,
      isDelivered: row.is_delivered,
      createdAt: row.created_at,
      readAt: row.read_at,
      deliveredAt: row.delivered_at,
    };
  }

  async getPendingNotifications(userId: string): Promise<Notification[]> {
    if (!this.db) {
      return [];
    }

    const query = `
      SELECT id, user_id, type, title, message, data, is_read, is_delivered, created_at, read_at, delivered_at
      FROM notifications
      WHERE user_id = $1 AND is_delivered = false
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      isRead: row.is_read,
      isDelivered: row.is_delivered,
      createdAt: row.created_at,
      readAt: row.read_at,
      deliveredAt: row.delivered_at,
    }));
  }

  async markAsDelivered(notificationIds: string[]): Promise<void> {
    if (!this.db || notificationIds.length === 0) {
      return;
    }

    const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(', ');
    const query = `
      UPDATE notifications
      SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP
      WHERE id = ANY(ARRAY[${placeholders}])
    `;

    await this.db.query(query, notificationIds);
  }

  async markAsRead(notificationIds: string[]): Promise<void> {
    if (!this.db || notificationIds.length === 0) {
      return;
    }

    const placeholders = notificationIds.map((_, index) => `$${index + 2}`).join(', ');
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id = ANY(ARRAY[${placeholders}])
    `;

    await this.db.query(query, notificationIds);
  }

  private async ensureNotificationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        is_delivered BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP,
        delivered_at TIMESTAMP
      )
    `;

    await this.db.query(query);
  }
}
```

Create `server/src/modules/realtime/realtime.routes.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { WebSocketManager } from './websocket';

export default async function realtimeRoutes(fastify: FastifyInstance) {
  const wsManager = new WebSocketManager();

  // Register WebSocket plugin
  fastify.register(require('@fastify/websocket'));

  // WebSocket connection handler
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    wsManager.handleConnection(connection.ws, request, fastify);
  });

  // Add notification sending helper to server instance
  fastify.decorate('wsManager', wsManager);

  // REST API for notifications (fallback when WebSocket is not available)
  fastify.post('/notifications', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'type', 'title', 'message'],
        properties: {
          userId: { type: 'string' },
          type: { type: 'string', enum: ['info', 'warning', 'error', 'success'] },
          title: { type: 'string' },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const notificationData = request.body as any;

      // Create notification in database
      const notificationService = wsManager['notificationService'];
      const notification = await notificationService.createNotification(notificationData);

      // Send real-time notification via WebSocket
      wsManager.broadcastToUser(notificationData.userId, {
        type: 'notification',
        data: notification,
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        success: true,
        data: { notificationId: notification.id },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to send notification',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
```

**Step 4: Update server to include WebSocket routes**

Update `server/src/server.ts`:
```typescript
import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/config';
import authRoutes from './modules/auth/auth.routes';
import financialRoutes from './modules/financial/transaction.routes';
import realtimeRoutes from './modules/realtime/realtime.routes';

const server: FastifyInstance = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.isDevelopment ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Register CORS
server.register(require('@fastify/cors'), {
  origin: config.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// Register routes
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(financialRoutes, { prefix: '/api/v1/financial' });
server.register(realtimeRoutes, { prefix: '/api/v1/realtime' });

// Keep existing setup...
// ... rest of the server.ts file remains the same
```

**Step 5: Add WebSocket dependency**

```bash
cd server && pnpm add ws @types/ws
```

**Step 6: Run test to verify it passes**

```bash
cd server && npm test tests/modules/realtime/websocket.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add server/src/modules/realtime/ server/src/server.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat: implement WebSocket real-time features with authentication and notifications"
```

## Phase 5: Implementation Planning Complete

This comprehensive implementation plan provides:

1. **Complete Modular Architecture** - Authentication, user management, financial transactions, and real-time features
2. **Test-Driven Development** - Every module has comprehensive tests
3. **Database Integration** - PostgreSQL for data persistence and Redis for caching
4. **Security** - JWT authentication, password hashing, role-based access
5. **Real-time Features** - WebSocket connections with notification system
6. **API Standards** - Consistent response formats, error handling, and pagination
7. **Scalable Design** - Modular monolith that can evolve to microservices

**Plan complete and saved to `docs/plans/2025-10-27-Finquanta-ai-server-design.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach would you prefer for implementing this comprehensive Finquanta AI server?