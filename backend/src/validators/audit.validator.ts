import { z } from 'zod';

export const createAuditCycleSchema = z.object({
  name: z.string().min(3, 'Audit name must be at least 3 characters'),
  scopeDepartmentId: z.string().uuid('Invalid department ID').optional().nullable().or(z.literal('')),
  scopeLocation: z.string().optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Start date must be a valid date string',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'End date must be a valid date string',
  }),
  auditorIds: z.array(z.string().uuid('Invalid auditor user ID')).min(1, 'Must assign at least one auditor'),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

export const recordAuditSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
  status: z.enum(['VERIFIED', 'MISSING', 'DAMAGED'], {
    errorMap: () => ({ message: 'Audit status must be VERIFIED, MISSING, or DAMAGED' }),
  }),
  notes: z.string().optional().nullable(),
});
