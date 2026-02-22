/**
 * ToolPolicyService Tests
 * Verifies allow/deny lists, call budgets, and timeout behavior.
 */

import { z } from 'zod';
import { zodSchema } from 'ai';
import { applyToolPolicies, clearTaskToolBudget } from '../src/services/toolPolicyService';

function createTool(execute: (input: Record<string, unknown>) => Promise<unknown>) {
  return {
    description: 'test-tool',
    inputSchema: zodSchema(z.object({ value: z.string().optional() })),
    execute
  };
}

describe('ToolPolicyService', () => {
  beforeEach(() => {
    clearTaskToolBudget('task-1');
    clearTaskToolBudget('task-2');
    clearTaskToolBudget('task-3');
  });

  it('blocks denied tools', async () => {
    const tools = {
      dangerousTool: createTool(async () => ({ ok: true }))
    };

    const wrapped = applyToolPolicies('task-1', tools, {
      denyTools: ['dangerousTool']
    });

    await expect(wrapped.dangerousTool.execute({})).rejects.toThrow('not allowed');
  });

  it('enforces max tool calls per task', async () => {
    const tools = {
      safeTool: createTool(async () => ({ ok: true }))
    };

    const wrapped = applyToolPolicies('task-2', tools, {
      maxToolCallsPerTask: 1
    });

    await expect(wrapped.safeTool.execute({})).resolves.toEqual({ ok: true });
    await expect(wrapped.safeTool.execute({})).rejects.toThrow('exceeded max tool calls');
  });

  it('times out long running tools', async () => {
    const tools = {
      slowTool: createTool(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true };
      })
    };

    const wrapped = applyToolPolicies('task-3', tools, {
      perToolTimeoutMs: 10
    });

    await expect(wrapped.slowTool.execute({})).rejects.toThrow('timed out');
  });
});
