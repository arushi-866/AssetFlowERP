import { Response, Router } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { DepartmentRepository } from '../repositories/department.repository';
import { validateRequest } from '../middleware/validation';
import { loginSchema, signupSchema, promoteSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Public departments list for signup form
router.get('/departments', async (req, res, next) => {
  try {
    const list = await DepartmentRepository.findAllDepartments();
    res.json(list.map((d) => ({ id: d.id, name: d.name })));
  } catch (err) {
    next(err);
  }
});

// Signup endpoint (creates Employee role only)
router.post(
  '/signup',
  validateRequest({ body: signupSchema }),
  async (req, res, next) => {
    try {
      const { name, email, password, departmentId } = req.body;
      const user = await AuthService.register(name, email, password, departmentId);
      res.status(201).json({ message: 'User registered successfully as Employee. Admin promotion required for higher roles.', user });
    } catch (err) {
      next(err);
    }
  }
);

// Login endpoint
router.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const data = await AuthService.login(email, password);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// Password reset request
router.post(
  '/forgot-password',
  validateRequest({ body: forgotPasswordSchema }),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const response = await AuthService.requestPasswordReset(email);
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

// Password reset confirmation
router.post(
  '/reset-password',
  validateRequest({ body: resetPasswordSchema }),
  async (req, res, next) => {
    try {
      const { token, password } = req.body;
      await AuthService.resetPassword(token, password);
      res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
    } catch (err) {
      next(err);
    }
  }
);

// Promotion endpoint (Admin only)
router.post(
  '/promote',
  authenticateJWT,
  requireRole(['ADMIN']),
  validateRequest({ body: promoteSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { userId, roleName } = req.body;
      const adminId = req.user!.id;
      const user = await AuthService.promote(adminId, userId, roleName);
      res.json({ message: `User role promoted successfully to ${roleName}`, user });
    } catch (err) {
      next(err);
    }
  }
);

// Me endpoint
router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await UserRepository.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role_name,
      departmentId: user.department_id,
      departmentName: user.department_name,
      status: user.status,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
