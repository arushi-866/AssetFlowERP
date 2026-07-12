import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository, UserInput } from '../repositories/user.repository';
import { LogRepository } from '../repositories/log.repository';
import { runInTransaction } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'production-secret-assetflow-token-signature-key-2026';

export class AuthService {
  static async register(name: string, email: string, password123: string, departmentId?: string | null) {
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw { status: 400, message: 'An account with this email already exists' };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password123, salt);

    // Fetch the EMPLOYEE role to force safe account creation
    const employeeRole = await UserRepository.findRoleByName('EMPLOYEE');
    if (!employeeRole) {
      throw { status: 500, message: 'System role EMPLOYEE not configured' };
    }

    const newUser = await UserRepository.create({
      name,
      email,
      passwordHash,
      roleId: employeeRole.id,
      departmentId: departmentId || null,
    });

    return newUser;
  }

  static async login(email: string, password123: string) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (user.status !== 'ACTIVE') {
      throw { status: 403, message: 'Account is deactivated' };
    }

    const isMatch = await bcrypt.compare(password123, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    // Sign JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        departmentId: user.department_id,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        departmentId: user.department_id,
        departmentName: user.department_name,
      },
    };
  }

  static async requestPasswordReset(email: string) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      return {
        message: 'If an account exists for this email, a password reset token has been issued.',
      };
    }

    if (user.status !== 'ACTIVE') {
      return {
        message: 'If an account exists for this email, a password reset token has been issued.',
      };
    }

    const resetToken = jwt.sign(
      {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      message: 'Password reset token generated. Use this token to reset your password.',
      token: resetToken,
    };
  }

  static async resetPassword(token: string, password123: string) {
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET) as any;
    } catch (err) {
      throw { status: 400, message: 'Invalid or expired password reset token' };
    }

    if (payload?.purpose !== 'PASSWORD_RESET' || !payload?.userId) {
      throw { status: 400, message: 'Invalid password reset token' };
    }

    const user = await UserRepository.findById(payload.userId);
    if (!user) {
      throw { status: 400, message: 'Invalid password reset token' };
    }

    const passwordHash = await bcrypt.hash(password123, 10);
    await UserRepository.updatePassword(user.id, passwordHash);
  }

  static async promote(adminId: string, employeeId: string, roleName: string) {
    const targetRole = await UserRepository.findRoleByName(roleName);
    if (!targetRole) {
      throw { status: 400, message: `Role ${roleName} does not exist` };
    }

    const employee = await UserRepository.findById(employeeId);
    if (!employee) {
      throw { status: 404, message: 'Employee user not found' };
    }

    const updatedUser = await runInTransaction(async (client) => {
      // 1. If role is DEPARTMENT_HEAD and department is not set, throw error (dept head must belong to a dept)
      // Actually we let it happen or warn.
      
      // 2. Perform update
      const user = await UserRepository.updateRole(employeeId, targetRole.id, client);
      
      // 3. Log the promote
      await LogRepository.create({
        userId: adminId,
        action: 'ROLE_PROMOTION',
        targetTable: 'users',
        targetId: employeeId,
        previousValues: { role: employee.role_name },
        newValues: { role: roleName },
      });

      return user;
    });

    return updatedUser;
  }
}
