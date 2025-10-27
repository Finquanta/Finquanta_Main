import { UserRepository } from '../../../src/modules/users/user.repository';
import { Database } from '../../../src/infrastructure/database';
import { UserRole, User } from '../../../src/modules/users/types';

// Mock the Database class
jest.mock('../../../src/infrastructure/database');

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockDatabase: jest.Mocked<Database>;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock database
    mockDatabase = new Database() as jest.Mocked<Database>;
    mockQuery = jest.fn();
    mockDatabase.query = mockQuery;
    mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
    mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);
    mockDatabase.isConnected = jest.fn().mockReturnValue(true);

    userRepository = new UserRepository(mockDatabase);
  });

  describe('create', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER
      };

      const mockUserRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: userData.email,
        password_hash: userData.passwordHash,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const user = await userRepository.create(userData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [
          userData.email,
          userData.passwordHash,
          userData.firstName,
          userData.lastName,
          userData.role
        ]
      );

      expect(user).toBeDefined();
      expect(user.id).toBe(mockUserRow.id);
      expect(user.email).toBe(userData.email);
      expect(user.passwordHash).toBe(userData.passwordHash);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(userData.role);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should throw error when creating user with duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER
      };

      mockQuery.mockRejectedValue(new Error('Duplicate email'));

      await expect(userRepository.create(userData)).rejects.toThrow('Duplicate email');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const mockUserRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: email,
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.USER,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const foundUser = await userRepository.findByEmail(email);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT') &&
        expect.stringContaining('FROM users') &&
        expect.stringContaining('WHERE email = $1'),
        [email]
      );

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(mockUserRow.id);
      expect(foundUser?.email).toBe(email);
    });

    it('should return null when user not found by email', async () => {
      const email = 'nonexistent@example.com';
      mockQuery.mockResolvedValue({ rows: [] });

      const foundUser = await userRepository.findByEmail(email);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT') &&
        expect.stringContaining('FROM users') &&
        expect.stringContaining('WHERE email = $1'),
        [email]
      );

      expect(foundUser).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const mockUserRow = {
        id: userId,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        role: UserRole.USER,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const foundUser = await userRepository.findById(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT') &&
        expect.stringContaining('FROM users') &&
        expect.stringContaining('WHERE id = $1'),
        [userId]
      );

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(userId);
    });

    it('should return null when user not found by ID', async () => {
      const userId = 'nonexistent-id';
      mockQuery.mockResolvedValue({ rows: [] });

      const foundUser = await userRepository.findById(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT') &&
        expect.stringContaining('FROM users') &&
        expect.stringContaining('WHERE id = $1'),
        [userId]
      );

      expect(foundUser).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user with valid data', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const mockUserRow = {
        id: userId,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: updateData.firstName,
        last_name: updateData.lastName,
        role: UserRole.USER,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockQuery.mockResolvedValue({ rows: [mockUserRow] });

      const updatedUser = await userRepository.update(userId, updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users') &&
        expect.stringContaining('SET') &&
        expect.stringContaining('WHERE id = $'),
        expect.arrayContaining([updateData.firstName, updateData.lastName, userId])
      );

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.id).toBe(userId);
      expect(updatedUser?.firstName).toBe(updateData.firstName);
      expect(updatedUser?.lastName).toBe(updateData.lastName);
    });

    it('should return null when updating non-existent user', async () => {
      const userId = 'nonexistent-id';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      mockQuery.mockResolvedValue({ rows: [] });

      const updatedUser = await userRepository.update(userId, updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users') &&
        expect.stringContaining('SET') &&
        expect.stringContaining('WHERE id = $'),
        expect.arrayContaining([updateData.firstName, updateData.lastName, userId])
      );

      expect(updatedUser).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user by ID', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const deleteResult = await userRepository.delete(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        [userId]
      );

      expect(deleteResult).toBe(true);
    });

    it('should return false when deleting non-existent user', async () => {
      const userId = 'nonexistent-id';

      mockQuery.mockResolvedValue({ rowCount: 0 });

      const deleteResult = await userRepository.delete(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        [userId]
      );

      expect(deleteResult).toBe(false);
    });
  });
});