/**
 * Webhook Routes
 * CRUD + inbound trigger endpoints for webhook subsystem.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createWebhook,
  deleteWebhook,
  enqueueWebhookNotification,
  getWebhook,
  listWebhooks,
  triggerInboundWebhook,
  updateWebhook
} from '../services/webhookService';

const router = Router();

const createWebhookSchema = z.object({
  direction: z.enum(['inbound', 'outbound']),
  eventName: z.string().min(1),
  targetUrl: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  status: z.enum(['pending', 'delivered', 'failed', 'disabled']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const updateWebhookSchema = z.object({
  eventName: z.string().min(1).optional(),
  targetUrl: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  status: z.enum(['pending', 'delivered', 'failed', 'disabled']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

router.post('/inbound/:eventName', async (req: Request<{ eventName: string }>, res: Response) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Inbound webhook body must be a JSON object'
    });
  }

  try {
    const result = await triggerInboundWebhook(
      req.params.eventName,
      req.body as Record<string, unknown>,
      req.header('x-webhook-signature') ?? undefined
    );

    return res.status(202).json({
      success: true,
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process inbound webhook';
    const statusCode = message.includes('signature') ? 401 : 400;
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createWebhookSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook payload',
      details: parsed.error.flatten()
    });
  }

  try {
    const webhook = await createWebhook(parsed.data);
    return res.status(201).json({
      success: true,
      data: webhook
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create webhook'
    });
  }
});

router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: listWebhooks()
  });
});

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const webhook = getWebhook(req.params.id);
  if (!webhook) {
    return res.status(404).json({
      success: false,
      error: 'Webhook not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: webhook
  });
});

router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = updateWebhookSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook update payload',
      details: parsed.error.flatten()
    });
  }

  try {
    const updated = await updateWebhook(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update webhook'
    });
  }
});

router.post('/:id/test', async (req: Request<{ id: string }>, res: Response) => {
  const webhook = getWebhook(req.params.id);
  if (!webhook) {
    return res.status(404).json({
      success: false,
      error: 'Webhook not found'
    });
  }

  if (webhook.direction !== 'outbound') {
    return res.status(400).json({
      success: false,
      error: 'Only outbound webhooks can be tested'
    });
  }

  await enqueueWebhookNotification(webhook.eventName, {
    source: 'manual-test',
    webhookId: webhook.id,
    timestamp: new Date().toISOString(),
    ...(req.body && typeof req.body === 'object' ? req.body : {})
  });

  return res.status(202).json({
    success: true,
    data: { queued: true }
  });
});

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await deleteWebhook(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete webhook'
    });
  }
});

export default router;
