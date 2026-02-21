"use strict";
/**
 * Agent REST Routes
 * Express router for agent management endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentService_1 = require("../services/agentService");
const router = (0, express_1.Router)();
// POST /api/agents - Deploy new agent
router.post('/', (req, res) => {
    try {
        const { name, type, config = {} } = req.body;
        // Validate required fields
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }
        const agent = agentService_1.agentService.deployAgent(name, type, config);
        return res.status(201).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create agent'
        });
    }
});
// GET /api/agents - List all agents
router.get('/', (_req, res) => {
    try {
        const agents = agentService_1.agentService.listAgents();
        return res.status(200).json({
            success: true,
            data: agents
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list agents'
        });
    }
});
// GET /api/agents/:id - Get single agent by ID
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const agent = agentService_1.agentService.getAgent(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get agent'
        });
    }
});
// POST /api/agents/:id/start - Start agent
router.post('/:id/start', (req, res) => {
    try {
        const { id } = req.params;
        const agent = agentService_1.agentService.startAgent(id);
        return res.status(200).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Agent not found') {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start agent'
        });
    }
});
// POST /api/agents/:id/stop - Stop agent
router.post('/:id/stop', (req, res) => {
    try {
        const { id } = req.params;
        const agent = agentService_1.agentService.stopAgent(id);
        return res.status(200).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Agent not found') {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to stop agent'
        });
    }
});
// POST /api/agents/:id/restart - Restart agent
router.post('/:id/restart', (req, res) => {
    try {
        const { id } = req.params;
        const agent = agentService_1.agentService.restartAgent(id);
        return res.status(200).json({
            success: true,
            data: agent
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Agent not found') {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to restart agent'
        });
    }
});
// DELETE /api/agents/:id - Delete agent
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const deleted = agentService_1.agentService.deleteAgent(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete agent'
        });
    }
});
exports.default = router;
//# sourceMappingURL=agentRoutes.js.map