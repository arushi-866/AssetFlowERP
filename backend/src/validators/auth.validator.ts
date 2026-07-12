import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  departmentId: z.string().uuid().optional().nullable(),
});

export const promoteSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  roleName: z.enum(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'], {
    errorMap: () => ({ message: 'Invalid role selection. Choose ADMIN, ASSET_MANAGER, DEPARTMENT_HEAD, or EMPLOYEE' }),
  }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Invalid password reset token'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
