import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';

import authRouter from './controllers/auth.controller';
import orgRouter from './controllers/org.controller';
import assetRouter from './controllers/asset.controller';
import allocationRouter from './controllers/allocation.controller';
import bookingRouter from './controllers/booking.controller';
import maintenanceRouter from './controllers/maintenance.controller';
import auditRouter from './controllers/audit.controller';
import reportRouter from './controllers/report.controller';

import { errorHandler } from './middleware/errorHandler';
import { initWebSocketServer } from './websocket/server';
import { pool } from './config/db';

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// CORS setup
app.use(cors({
  origin: '*', // For development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/org', orgRouter);
app.use('/api/assets', assetRouter);
app.use('/api/allocations', allocationRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/audits', auditRouter);
app.use('/api/reports', reportRouter);

// Health check (includes database connectivity)
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date() });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      message: 'Start PostgreSQL and run npm run db:setup in the backend folder.',
      timestamp: new Date(),
    });
  }
});

// Global Error Handler
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server attached to HTTP server
initWebSocketServer(server);

// Start server
server.listen(port, async () => {
  console.log(`[AssetFlow Backend] Server running on http://localhost:${port}`);
  console.log(`[AssetFlow WebSocket] Server running on ws://localhost:${port}/ws`);

  try {
    await pool.query('SELECT 1');
    console.log('[AssetFlow Backend] Database connected');
  } catch {
    console.error(
      '[AssetFlow Backend] Database not connected. Start PostgreSQL, then run: npm run db:setup'
    );
  }
});
