import { Router, Response } from 'express';
import { DepartmentRepository } from '../repositories/department.repository';
import { UserRepository } from '../repositories/user.repository';
import { LogRepository } from '../repositories/log.repository';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import { runInTransaction } from '../config/db';
import { broadcast } from '../websocket/server';

const router = Router();

const createDeptSchema = z.object({
  name: z.string().min(2),
  headId: z.string().uuid().optional().nullable(),
  parentDepartmentId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

const updateDeptSchema = createDeptSchema;

const createCatSchema = z.object({
  name: z.string().min(2),
  customFields: z.record(z.string()).default({}),
});

const updateCatSchema = createCatSchema;

// DEPARTMENTS
router.get('/departments', authenticateJWT, async (req, res, next) => {
  try {
    const list = await DepartmentRepository.findAllDepartments();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/departments',
  authenticateJWT,
  requireRole(['ADMIN']),
  validateRequest({ body: createDeptSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const dept = await runInTransaction(async (client) => {
        const d = await DepartmentRepository.createDepartment(req.body);
        
        // Log department creation
        await LogRepository.create({
          userId: req.user!.id,
          action: 'CREATE_DEPARTMENT',
          targetTable: 'departments',
          targetId: d.id,
          newValues: d,
        });

        // If a headId is assigned, we should update their department as well, or just record
        if (req.body.headId) {
          // department heads should ideally belong to the department they manage
          await UserRepository.updateDepartment(req.body.headId, d.id, client);
        }

        return d;
      });

      broadcast('KPI_UPDATE', { source: 'CREATE_DEPARTMENT' });
      res.status(201).json(dept);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/departments/:id',
  authenticateJWT,
  requireRole(['ADMIN']),
  validateRequest({ body: updateDeptSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const prev = await DepartmentRepository.findDepartmentById(id);
      if (!prev) return res.status(404).json({ message: 'Department not found' });

      const dept = await runInTransaction(async (client) => {
        const d = await DepartmentRepository.updateDepartment(id, req.body, client);
        
        // Log department edit
        await LogRepository.create({
          userId: req.user!.id,
          action: 'UPDATE_DEPARTMENT',
          targetTable: 'departments',
          targetId: id,
          previousValues: prev,
          newValues: d,
        });

        // Update target user's department to this if promoted to head
        if (req.body.headId && req.body.headId !== prev.head_id) {
          // auto update user's dept
          await UserRepository.updateDepartment(req.body.headId, id, client);
        }

        return d;
      });

      broadcast('KPI_UPDATE', { source: 'UPDATE_DEPARTMENT' });
      res.json(dept);
    } catch (err) {
      next(err);
    }
  }
);

// CATEGORIES
router.get('/categories', authenticateJWT, async (req, res, next) => {
  try {
    const list = await DepartmentRepository.findAllCategories();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/categories',
  authenticateJWT,
  requireRole(['ADMIN']),
  validateRequest({ body: createCatSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const cat = await DepartmentRepository.createCategory(req.body);
      await LogRepository.create({
        userId: req.user!.id,
        action: 'CREATE_ASSET_CATEGORY',
        targetTable: 'asset_categories',
        targetId: cat.id,
        newValues: cat,
      });
      res.status(201).json(cat);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/categories/:id',
  authenticateJWT,
  requireRole(['ADMIN']),
  validateRequest({ body: updateCatSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const prev = await DepartmentRepository.findCategoryById(id);
      if (!prev) return res.status(404).json({ message: 'Category not found' });

      const cat = await DepartmentRepository.updateCategory(id, req.body.name, req.body.customFields);
      await LogRepository.create({
        userId: req.user!.id,
        action: 'UPDATE_ASSET_CATEGORY',
        targetTable: 'asset_categories',
        targetId: id,
        previousValues: prev,
        newValues: cat,
      });
      res.json(cat);
    } catch (err) {
      next(err);
    }
  }
);

// DIRECTORY
router.get('/employees', authenticateJWT, async (req, res, next) => {
  try {
    const list = await UserRepository.findAll();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// LOCATIONS
router.get('/locations', authenticateJWT, async (req, res, next) => {
  try {
    const list = await DepartmentRepository.findAllLocations();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export default router;
