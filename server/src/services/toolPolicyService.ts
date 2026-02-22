/**
 * ToolPolicyService
 * Enforces per-agent tool governance and execution budgets.
 */

import { tool } from 'ai';
import { ToolPolicy } from '../../types';
import { incrementMetric } from './metricsService';

const perTaskToolCallCount = new Map<string, number>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function isToolAllowed(toolName: string, policy: ToolPolicy): boolean {
  if (policy.denyTools?.includes(toolName)) {
    return false;
  }

  if (policy.allowTools && policy.allowTools.length > 0) {
    return policy.allowTools.includes(toolName);
  }

  return true;
}

export function clearTaskToolBudget(taskId: string): void {
  perTaskToolCallCount.delete(taskId);
}

export function applyToolPolicies(
  taskId: string,
  tools: Record<string, any>,
  policy: ToolPolicy
): Record<string, any> {
  const timeoutMs = policy.perToolTimeoutMs ?? 30_000;
  const maxToolCalls = policy.maxToolCallsPerTask ?? 40;

  const wrapped: Record<string, any> = {};

  for (const [toolName, toolDef] of Object.entries(tools)) {
    wrapped[toolName] = tool({
      description: toolDef?.description ?? `Execute ${toolName}`,
      inputSchema: toolDef?.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        if (!isToolAllowed(toolName, policy)) {
          incrementMetric('toolFailures');
          throw new Error(`Tool ${toolName} is not allowed by policy`);
        }

        const callCount = (perTaskToolCallCount.get(taskId) ?? 0) + 1;
        perTaskToolCallCount.set(taskId, callCount);

        if (callCount > maxToolCalls) {
          incrementMetric('toolFailures');
          throw new Error(`Task ${taskId} exceeded max tool calls (${maxToolCalls})`);
        }

        incrementMetric('toolCalls');

        try {
          const executeFn = toolDef?.execute as ((input: Record<string, unknown>) => Promise<unknown>) | undefined;
          if (!executeFn) {
            throw new Error(`Tool ${toolName} is missing execute function`);
          }

          return await withTimeout(Promise.resolve(executeFn(args)), timeoutMs);
        } catch (error) {
          incrementMetric('toolFailures');
          throw error;
        }
      }
    });
  }

  return wrapped;
}
