/**
 * ClaudeCliService tests
 */

import { Task } from '../types';
import { executeClaudeCliTask } from '../src/services/claudeCliService';

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-claude-1',
    agentId: 'agent-1',
    type: 'claude-cli-task',
    data: {
      prompt: 'ignored prompt',
      claude: {
        command: 'node',
        args: ['-e', 'process.stdout.write("ok")'],
        appendPromptAsArg: false,
        timeoutMs: 5000,
        workingDirectory: process.cwd(),
        allowedCommands: ['node']
      }
    },
    executionMode: 'claude_cli',
    status: 'pending',
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('ClaudeCliService', () => {
  it('executes a local allowed command and returns stdout', async () => {
    const task = createTask();

    const result = await executeClaudeCliTask(task, {
      claude: {
        allowedCommands: ['node']
      }
    });

    expect(result.message).toContain('ok');
    expect(result.stdout).toContain('ok');
    expect(result.metadata.executionMode).toBe('claude_cli');
    expect(result.metadata.command).toBe('node');
  });

  it('rejects commands outside the allowlist', async () => {
    const task = createTask({
      data: {
        prompt: 'run',
        claude: {
          command: 'node',
          args: ['-e', 'process.stdout.write("blocked")'],
          appendPromptAsArg: false,
          timeoutMs: 5000,
          workingDirectory: process.cwd(),
          allowedCommands: ['claude']
        }
      }
    });

    await expect(executeClaudeCliTask(task, {})).rejects.toThrow("Command 'node' is not allowed");
  });
});
