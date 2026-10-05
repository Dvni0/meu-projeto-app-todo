export type UserRole = 'student' | 'teacher';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}