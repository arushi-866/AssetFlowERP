import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error Handler]', err);

  const connectionError =
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.errors?.some((e: { code?: string }) => e.code === 'ECONNREFUSED');

  if (connectionError) {
    return res.status(503).json({
      message:
        'Database is unavailable. Start PostgreSQL and run npm run db:setup in the backend folder.',
    });
  }

  if (err.code === '3D000') {
    return res.status(503).json({
      message: 'Database not initialized. Run npm run db:setup in the backend folder.',
    });
  }

  // Check for Postgres errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        // Extract field name from detail if possible, e.g., "Key (email)=(test@test.com) already exists."
        const matchUnique = err.detail?.match(/Key \((.*?)\)=\((.*?)\) already exists/);
        const fieldUnique = matchUnique ? matchUnique[1] : 'field';
        return res.status(409).json({
          message: `Conflict: A record with this ${fieldUnique} already exists.`,
          error: err.detail,
        });

      case '23503': // Foreign key violation
        return res.status(400).json({
          message: 'Relation Error: The referenced entity does not exist, or this record is linked and cannot be deleted.',
          error: err.detail,
        });

      case '23514': // Check violation
        return res.status(400).json({
          message: `Business Rule Violation: ${err.message || 'The data violates database constraints.'}`,
          error: err.detail,
        });

      case '23P01': // Exclusion violation (Overlapping bookings!)
        return res.status(409).json({
          message: 'Booking conflict: The resource is already booked for the selected time slot.',
          error: err.detail,
        });
    }
  }

  // Check custom errors that might have statuses
  const status = err.status || 500;
  const message = err.message || 'An unexpected internal server error occurred';

  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
