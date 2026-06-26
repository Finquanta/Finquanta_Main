export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  OWNER = 'owner'
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string; // 'active' | 'suspended'
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  dateOfBirth?: string; // 'YYYY-MM-DD'
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  acceptedRisk?: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: string;
}