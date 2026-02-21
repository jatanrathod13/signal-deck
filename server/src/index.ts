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
import { initializeSocket } from './services/socketService';
import { startWorker, stopWorker } from '../worker/taskWorker';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Create Express app
const app: Express = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Agent routes
app.use('/api/agents', agentRoutes);

// Task routes
app.use('/api/tasks', taskRoutes);

// Memory routes
app.use('/api/memory', memoryRoutes);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
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
  console.log('Client connected:', socket.id);

  // Join agent-specific room
  socket.on('join-agent', (agentId: string) => {
    socket.join(`agent:${agentId}`);
    console.log(`Socket ${socket.id} joined agent:${agentId}`);
  });

  // Leave agent room
  socket.on('leave-agent', (agentId: string) => {
    socket.leave(`agent:${agentId}`);
    console.log(`Socket ${socket.id} left agent:${agentId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
export async function createServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startWorker();
      resolve(server);
    });
  });
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await stopWorker();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await stopWorker();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing and other modules
export { app, io, server };

// Start server automatically when run directly
if (require.main === module) {
  createServer();
}
