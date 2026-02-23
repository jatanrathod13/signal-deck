/**
 * Agent Orchestration Platform - Server Entry Point
 * Express + Socket.IO server with CORS and health check
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import agentRoutes from './routes/agentRoutes';
import taskRoutes from './routes/taskRoutes';
import memoryRoutes from './routes/memoryRoutes';
import planRoutes from './routes/planRoutes';
import metricsRoutes from './routes/metricsRoutes';
import conversationRoutes from './routes/conversationRoutes';
import runRoutes from './routes/runRoutes';
import toolRoutes from './routes/toolRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import systemRoutes from './routes/systemRoutes';
import webhookRoutes from './routes/webhookRoutes';
import governanceRoutes from './routes/governanceRoutes';
import { initializeSocket } from './services/socketService';
import { initializeAgentPersistence } from './services/agentService';
import { bootstrapTaskStore } from './services/taskQueueService';
import { initializePlans } from './services/planService';
import { initializeConversationStore } from './services/conversationService';
import { initializeApprovalStore } from './services/governanceService';
import { initializeScheduleService, stopScheduleService } from './services/scheduleService';
import { initializeWebhookService, stopWebhookService } from './services/webhookService';
import { startWorker, stopWorker } from '../worker/taskWorker';
import { requestContextMiddleware } from './middleware/requestContextMiddleware';
import { supabaseAuthMiddleware } from './middleware/authMiddleware';
import { httpRateLimitMiddleware } from './middleware/rateLimitMiddleware';
import { logger } from './lib/logger';
import { getReadinessSnapshot } from './services/readinessService';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Create Express app
const app: Express = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(requestContextMiddleware);
app.use('/api', httpRateLimitMiddleware, supabaseAuthMiddleware);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req: Request, res: Response) => {
  const snapshot = await getReadinessSnapshot();
  const statusCode = snapshot.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json({
    status: snapshot.status,
    checks: snapshot.checks,
    timestamp: snapshot.timestamp
  });
});

// Agent routes
app.use('/api/agents', agentRoutes);

// Task routes
app.use('/api/tasks', taskRoutes);

// Memory routes
app.use('/api/memory', memoryRoutes);

// Plan routes
app.use('/api/plans', planRoutes);

// Metrics routes
app.use('/api/metrics', metricsRoutes);

// Conversation routes
app.use('/api/conversations', conversationRoutes);

// Run routes
app.use('/api/runs', runRoutes);

// Schedule routes
app.use('/api/schedules', scheduleRoutes);

// Webhook routes
app.use('/api/webhooks', webhookRoutes);

// Tool routes
app.use('/api/tools', toolRoutes);

// Governance routes
app.use('/api/governance', governanceRoutes);

// System routes
app.use('/api/system', systemRoutes);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({
    requestId: _req.requestId,
    error: err.message,
    stack: err.stack
  }, 'server.error');
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server with CORS
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Initialize Socket.IO with the socketService
initializeSocket(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'socket.connected');

  // Join agent-specific room
  socket.on('join-agent', (agentId: string) => {
    socket.join(`agent:${agentId}`);
    logger.info({ socketId: socket.id, agentId }, 'socket.join_agent');
  });

  // Leave agent room
  socket.on('leave-agent', (agentId: string) => {
    socket.leave(`agent:${agentId}`);
    logger.info({ socketId: socket.id, agentId }, 'socket.leave_agent');
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'socket.disconnected');
  });
});

// Start server
export async function createServer(): Promise<http.Server> {
  await initializeAgentPersistence();
  await bootstrapTaskStore();
  await initializePlans();
  await initializeConversationStore();
  await initializeApprovalStore();
  await initializeScheduleService();
  await initializeWebhookService();

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'server.started');
      startWorker();
      resolve(server);
    });
  });
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('signal.sigterm_received');
  await stopScheduleService();
  await stopWebhookService();
  await stopWorker();
  server.close(() => {
    logger.info('server.closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('signal.sigint_received');
  await stopScheduleService();
  await stopWebhookService();
  await stopWorker();
  server.close(() => {
    logger.info('server.closed');
    process.exit(0);
  });
});

// Export for testing and other modules
export { app, io, server };

// Start server automatically when run directly
if (require.main === module) {
  createServer();
}
