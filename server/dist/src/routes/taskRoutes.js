"use strict";
/**
 * Task REST Routes
 * Express router for task queue management endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskQueueService_1 = require("../services/taskQueueService");
const router = (0, express_1.Router)();
// POST /api/tasks - Submit new task
router.post('/', async (req, res) => {
    try {
        const { agentId, type, data = {}, priority = 1 } = req.body;
        // Validate required fields
        if (!agentId || !type) {
            return res.status(400).json({
                success: false,
                error: 'agentId and type are required'
            });
        }
        // Create task object
        const task = {
            id: '',
            agentId,
            type,
            data,
            status: 'pending',
            priority,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const taskId = await (0, taskQueueService_1.submitTask)(task);
        const createdTask = (0, taskQueueService_1.getTask)(taskId);
        return res.status(201).json({
            success: true,
            data: createdTask
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create task'
        });
    }
});
// GET /api/tasks - List all tasks (supports ?status=pending)
router.get('/', (req, res) => {
    try {
        const { status } = req.query;
        let tasks = (0, taskQueueService_1.getAllTasks)();
        // Filter by status if provided
        if (status) {
            tasks = tasks.filter(task => task.status === status);
        }
        return res.status(200).json({
            success: true,
            data: tasks
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list tasks'
        });
    }
});
// GET /api/tasks/:id - Get task by ID
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const task = (0, taskQueueService_1.getTask)(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: task
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get task'
        });
    }
});
// DELETE /api/tasks/:id - Cancel task
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const task = (0, taskQueueService_1.getTask)(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        // Check if task can be cancelled
        if (task.status !== 'pending' && task.status !== 'processing') {
            return res.status(400).json({
                success: false,
                error: 'Task already processing'
            });
        }
        const cancelled = (0, taskQueueService_1.cancelTask)(id);
        if (!cancelled) {
            return res.status(400).json({
                success: false,
                error: 'Failed to cancel task'
            });
        }
        const updatedTask = (0, taskQueueService_1.getTask)(id);
        return res.status(200).json({
            success: true,
            data: updatedTask
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel task'
        });
    }
});
// POST /api/tasks/:id/retry - Retry failed task
router.post('/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const task = (0, taskQueueService_1.getTask)(id);
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        // Can only retry failed or cancelled tasks
        if (task.status !== 'failed' && task.status !== 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'Task can only be retried if it is failed or cancelled'
            });
        }
        const newTaskId = await (0, taskQueueService_1.retryTask)(id);
        const newTask = (0, taskQueueService_1.getTask)(newTaskId);
        return res.status(200).json({
            success: true,
            data: newTask
        });
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retry task'
        });
    }
});
exports.default = router;
//# sourceMappingURL=taskRoutes.js.map