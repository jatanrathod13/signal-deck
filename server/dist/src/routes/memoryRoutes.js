"use strict";
/**
 * Shared Memory REST Routes
 * Express router for shared memory management endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sharedMemoryService_1 = require("../services/sharedMemoryService");
const router = (0, express_1.Router)();
// POST /api/memory - Set value
router.post('/', async (req, res) => {
    try {
        const { key, value, ttl } = req.body;
        // Validate required fields
        if (!key || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Key and value are required'
            });
        }
        await (0, sharedMemoryService_1.setValue)(key, value, ttl);
        return res.status(201).json({
            success: true,
            data: { key, value }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set memory value'
        });
    }
});
// GET /api/memory - List keys
router.get('/', async (_req, res) => {
    try {
        const keys = await (0, sharedMemoryService_1.listKeys)();
        return res.status(200).json({
            success: true,
            data: keys
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list memory keys'
        });
    }
});
// GET /api/memory/:key - Get value
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const value = await (0, sharedMemoryService_1.getValue)(key);
        if (value === null) {
            return res.status(404).json({
                success: false,
                error: 'Key not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: { key, value }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get memory value'
        });
    }
});
// DELETE /api/memory/:key - Delete value
router.delete('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const deleted = await (0, sharedMemoryService_1.deleteValue)(key);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Key not found'
            });
        }
        return res.status(200).json({
            success: true,
            data: { key }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete memory value'
        });
    }
});
exports.default = router;
//# sourceMappingURL=memoryRoutes.js.map