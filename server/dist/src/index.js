"use strict";
/**
 * Agent Orchestration Platform - Server Entry Point
 * Express + Socket.IO server with CORS and health check
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.io = exports.app = void 0;
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const agentRoutes_1 = __importDefault(require("./routes/agentRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const memoryRoutes_1 = __importDefault(require("./routes/memoryRoutes"));
const socketService_1 = require("./services/socketService");
const taskWorker_1 = require("../worker/taskWorker");
const PORT = parseInt(process.env.PORT || '3001', 10);
// Create Express app
const app = (0, express_1.default)();
exports.app = app;
// Middleware
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Agent routes
app.use('/api/agents', agentRoutes_1.default);
// Task routes
app.use('/api/tasks', taskRoutes_1.default);
// Memory routes
app.use('/api/memory', memoryRoutes_1.default);
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});
// Create HTTP server
const server = http_1.default.createServer(app);
exports.server = server;
// Create Socket.IO server with CORS
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*'
    }
});
exports.io = io;
// Initialize Socket.IO with the socketService
(0, socketService_1.initializeSocket)(io);
// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Join agent-specific room
    socket.on('join-agent', (agentId) => {
        socket.join(`agent:${agentId}`);
        console.log(`Socket ${socket.id} joined agent:${agentId}`);
    });
    // Leave agent room
    socket.on('leave-agent', (agentId) => {
        socket.leave(`agent:${agentId}`);
        console.log(`Socket ${socket.id} left agent:${agentId}`);
    });
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
// Start server
async function createServer() {
    return new Promise((resolve) => {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            (0, taskWorker_1.startWorker)();
            resolve(server);
        });
    });
}
// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await (0, taskWorker_1.stopWorker)();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await (0, taskWorker_1.stopWorker)();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
// Start server automatically when run directly
if (require.main === module) {
    createServer();
}
//# sourceMappingURL=index.js.map