import { User, CreateUserData, UpdateUserData, UserRole } from './types';

export class UserModel implements User {
  public readonly id: string;
  public readonly email: string;
  public readonly passwordHash: string;
  public readonly firstName: string;
  public readonly lastName: string;
  public readonly role: UserRole;
  public readonly status: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: User) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.role = data.role;
    this.status = data.status ?? 'active';
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static create(userData: CreateUserData, id: string): UserModel {
    const now = new Date();
    return new UserModel({
      id,
      email: userData.email,
      passwordHash: userData.passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      status: 'active',
      createdAt: now,
      updatedAt: now
    });
  }

  update(updateData: UpdateUserData): UserModel {
    return new UserModel({
      ...this,
      firstName: updateData.firstName ?? this.firstName,
      lastName: updateData.lastName ?? this.lastName,
      role: updateData.role ?? this.role,
      status: updateData.status ?? this.status,
      updatedAt: new Date()
    });
  }

  toJSON(): User {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}