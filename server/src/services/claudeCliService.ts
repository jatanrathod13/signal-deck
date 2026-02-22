/**
 * ClaudeCliService
 * Executes local Claude CLI tasks with command guardrails.
 */

import { spawn } from 'child_process';
import path from 'path';
import { Task } from '../../types';
import { appendRunEvent } from './conversationService';
import { emitTaskLog } from './socketService';

interface ClaudeConfigInput {
  command?: string;
  baseArgs?: string[];
  args?: string[];
  promptFlag?: string;
  appendPromptAsArg?: boolean;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  workingDirectory?: string;
  allowedCommands?: string[];
}

interface ResolvedClaudeExecutionConfig {
  command: string;
  args: string[];
  timeoutMs: number;
  idleTimeoutMs: number;
  workingDirectory: string;
  maxOutputChars: number;
  maxDeltaEvents: number;
  maxSocketChunkChars: number;
}

export interface ClaudeCliExecutionResult {
  message: string;
  finishReason: string;
  metadata: {
    executionMode: 'claude_cli';
    command: string;
    args: string[];
    workingDirectory: string;
    durationMs: number;
    exitCode: number;
    signal: string | null;
    truncatedOutput: boolean;
  };
  stdout: string;
  stderr: string;
}

interface TaskClaudePayload {
  prompt?: unknown;
  objective?: unknown;
  claude?: unknown;
}

const DEFAULT_COMMAND = 'claude';
const DEFAULT_PROMPT_FLAG = '-p';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_MAX_OUTPUT_CHARS = 200_000;
const DEFAULT_MAX_DELTA_EVENTS = 200;
const DEFAULT_MAX_SOCKET_CHUNK_CHARS = 4_000;

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseClaudeConfig(raw: unknown): ClaudeConfigInput {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const data = raw as Record<string, unknown>;
  return {
    command: typeof data.command === 'string' ? data.command : undefined,
    baseArgs: parseStringArray(data.baseArgs),
    args: parseStringArray(data.args),
    promptFlag: typeof data.promptFlag === 'string' ? data.promptFlag : undefined,
    appendPromptAsArg: typeof data.appendPromptAsArg === 'boolean' ? data.appendPromptAsArg : undefined,
    timeoutMs: typeof data.timeoutMs === 'number' ? data.timeoutMs : undefined,
    idleTimeoutMs: typeof data.idleTimeoutMs === 'number' ? data.idleTimeoutMs : undefined,
    workingDirectory: typeof data.workingDirectory === 'string' ? data.workingDirectory : undefined,
    allowedCommands: parseStringArray(data.allowedCommands)
  };
}

function resolveWorkspaceRoot(): string {
  if (typeof process.env.CLAUDE_WORKSPACE_ROOT === 'string' && process.env.CLAUDE_WORKSPACE_ROOT.trim().length > 0) {
    return path.resolve(process.env.CLAUDE_WORKSPACE_ROOT);
  }

  return process.cwd();
}

function resolveAllowedCommands(agentConfig: ClaudeConfigInput, taskConfig: ClaudeConfigInput): string[] {
  const fromTask = taskConfig.allowedCommands ?? [];
  const fromAgent = agentConfig.allowedCommands ?? [];

  if (fromTask.length > 0) {
    return Array.from(new Set(fromTask));
  }

  if (fromAgent.length > 0) {
    return Array.from(new Set(fromAgent));
  }

  const envAllowlist = process.env.CLAUDE_ALLOWED_COMMANDS;
  if (typeof envAllowlist === 'string' && envAllowlist.trim().length > 0) {
    return envAllowlist
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [DEFAULT_COMMAND];
}

function normalizeExecutable(command: string): string {
  return path.basename(command.trim());
}

function ensureCommandAllowed(command: string, allowedCommands: string[]): void {
  const normalized = normalizeExecutable(command);
  const allowed = new Set(allowedCommands.map((entry) => normalizeExecutable(entry)));

  if (!allowed.has(normalized)) {
    throw new Error(`Command '${command}' is not allowed. Allowed commands: ${Array.from(allowed).join(', ')}`);
  }
}

function resolveWorkingDirectory(requestedDirectory?: string): string {
  const workspaceRoot = resolveWorkspaceRoot();

  if (!requestedDirectory || requestedDirectory.trim().length === 0) {
    return workspaceRoot;
  }

  const resolved = path.resolve(requestedDirectory);
  const allowOutsideWorkspace = process.env.CLAUDE_ALLOW_OUTSIDE_WORKSPACE === 'true';

  if (!allowOutsideWorkspace) {
    const normalizedWorkspace = workspaceRoot.endsWith(path.sep) ? workspaceRoot : `${workspaceRoot}${path.sep}`;
    const insideWorkspace = resolved === workspaceRoot || resolved.startsWith(normalizedWorkspace);

    if (!insideWorkspace) {
      throw new Error(`Working directory '${resolved}' is outside workspace root '${workspaceRoot}'`);
    }
  }

  return resolved;
}

function resolvePrompt(payload: TaskClaudePayload): string {
  if (typeof payload.prompt === 'string' && payload.prompt.trim().length > 0) {
    return payload.prompt.trim();
  }

  if (typeof payload.objective === 'string' && payload.objective.trim().length > 0) {
    return payload.objective.trim();
  }

  return '';
}

function resolveClaudeExecutionConfig(task: Task, agentConfig: Record<string, unknown>): ResolvedClaudeExecutionConfig {
  const payload = (task.data ?? {}) as TaskClaudePayload;
  const taskClaudeConfig = parseClaudeConfig(payload.claude);
  const agentClaudeConfig = parseClaudeConfig(agentConfig.claude);

  const command = taskClaudeConfig.command ?? agentClaudeConfig.command ?? DEFAULT_COMMAND;
  const promptFlag = taskClaudeConfig.promptFlag ?? agentClaudeConfig.promptFlag ?? DEFAULT_PROMPT_FLAG;

  const appendPromptAsArg = parseBoolean(
    taskClaudeConfig.appendPromptAsArg ?? agentClaudeConfig.appendPromptAsArg,
    true
  );

  const args = [
    ...parseStringArray(agentClaudeConfig.baseArgs),
    ...parseStringArray(taskClaudeConfig.args)
  ];

  const prompt = resolvePrompt(payload);
  if (appendPromptAsArg && prompt.length > 0) {
    if (promptFlag.length > 0) {
      args.push(promptFlag);
    }
    args.push(prompt);
  }

  const timeoutMs = parseNumber(
    taskClaudeConfig.timeoutMs ?? agentClaudeConfig.timeoutMs,
    parseNumber(process.env.CLAUDE_TASK_TIMEOUT_MS ? Number(process.env.CLAUDE_TASK_TIMEOUT_MS) : undefined, DEFAULT_TIMEOUT_MS)
  );
  const idleTimeoutMs = parseNumber(
    taskClaudeConfig.idleTimeoutMs ?? agentClaudeConfig.idleTimeoutMs ??
      (process.env.CLAUDE_IDLE_TIMEOUT_MS ? Number(process.env.CLAUDE_IDLE_TIMEOUT_MS) : undefined),
    DEFAULT_IDLE_TIMEOUT_MS
  );

  const maxOutputChars = parseNumber(
    process.env.CLAUDE_MAX_OUTPUT_CHARS ? Number(process.env.CLAUDE_MAX_OUTPUT_CHARS) : undefined,
    DEFAULT_MAX_OUTPUT_CHARS
  );

  const maxDeltaEvents = parseNumber(
    process.env.CLAUDE_MAX_DELTA_EVENTS ? Number(process.env.CLAUDE_MAX_DELTA_EVENTS) : undefined,
    DEFAULT_MAX_DELTA_EVENTS
  );
  const maxSocketChunkChars = parseNumber(
    process.env.CLAUDE_MAX_SOCKET_CHUNK_CHARS ? Number(process.env.CLAUDE_MAX_SOCKET_CHUNK_CHARS) : undefined,
    DEFAULT_MAX_SOCKET_CHUNK_CHARS
  );

  const workingDirectory = resolveWorkingDirectory(taskClaudeConfig.workingDirectory ?? agentClaudeConfig.workingDirectory);
  const allowedCommands = resolveAllowedCommands(agentClaudeConfig, taskClaudeConfig);
  ensureCommandAllowed(command, allowedCommands);

  return {
    command,
    args,
    timeoutMs,
    idleTimeoutMs,
    workingDirectory,
    maxOutputChars,
    maxDeltaEvents,
    maxSocketChunkChars
  };
}

function truncateOutput(value: string, maxChars: number): { value: string; truncated: boolean } {
  if (value.length <= maxChars) {
    return { value, truncated: false };
  }

  const omittedCount = value.length - maxChars;
  return {
    value: `${value.slice(0, maxChars)}\n...[output truncated, omitted ${omittedCount} characters]`,
    truncated: true
  };
}

function emitRunEventDelta(
  task: Task,
  delta: string,
  emittedDeltaEvents: number,
  maxDeltaEvents: number,
  channel: 'stdout' | 'stderr'
): number {
  if (!task.runId || !task.conversationId) {
    return emittedDeltaEvents;
  }

  if (emittedDeltaEvents >= maxDeltaEvents) {
    return emittedDeltaEvents;
  }

  appendRunEvent({
    runId: task.runId,
    conversationId: task.conversationId,
    type: channel === 'stdout' ? 'message.delta' : 'tool.error',
    payload: {
      source: 'claude_cli',
      channel,
      delta
    }
  });

  return emittedDeltaEvents + 1;
}

function truncateChunkForSocket(chunk: string, maxChars: number): string {
  if (chunk.length <= maxChars) {
    return chunk;
  }

  return `${chunk.slice(0, maxChars)}\n...[log chunk truncated]`;
}

/**
 * Execute local Claude CLI command for a task.
 */
export async function executeClaudeCliTask(
  task: Task,
  agentConfig: Record<string, unknown>
): Promise<ClaudeCliExecutionResult> {
  const resolvedConfig = resolveClaudeExecutionConfig(task, agentConfig);
  const startTime = Date.now();

  if (task.runId && task.conversationId) {
    appendRunEvent({
      runId: task.runId,
      conversationId: task.conversationId,
      type: 'tool.call',
      payload: {
        toolName: 'claude_cli',
        command: resolvedConfig.command,
        args: resolvedConfig.args,
        workingDirectory: resolvedConfig.workingDirectory
      }
    });
  }

  return new Promise<ClaudeCliExecutionResult>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let emittedDeltaEvents = 0;
    let timeoutReason: 'timeout' | 'idle_timeout' | null = null;

    const child = spawn(resolvedConfig.command, resolvedConfig.args, {
      cwd: resolvedConfig.workingDirectory,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    emitTaskLog(task.id, task.agentId, 'system', `Running ${resolvedConfig.command} ${resolvedConfig.args.join(' ')}`.trim());

    let forceKillTimeout: NodeJS.Timeout | undefined;
    let idleTimeout: NodeJS.Timeout | undefined;

    const timeout = setTimeout(() => {
      timeoutReason = 'timeout';
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, 2_000);
    }, resolvedConfig.timeoutMs);

    const resetIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      idleTimeout = setTimeout(() => {
        timeoutReason = 'idle_timeout';
        child.kill('SIGTERM');
        forceKillTimeout = setTimeout(() => {
          child.kill('SIGKILL');
        }, 2_000);
      }, resolvedConfig.idleTimeoutMs);
    };

    resetIdleTimeout();

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      emittedDeltaEvents = emitRunEventDelta(task, text, emittedDeltaEvents, resolvedConfig.maxDeltaEvents, 'stdout');
      emitTaskLog(task.id, task.agentId, 'stdout', truncateChunkForSocket(text, resolvedConfig.maxSocketChunkChars));
      resetIdleTimeout();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      emittedDeltaEvents = emitRunEventDelta(task, text, emittedDeltaEvents, resolvedConfig.maxDeltaEvents, 'stderr');
      emitTaskLog(task.id, task.agentId, 'stderr', truncateChunkForSocket(text, resolvedConfig.maxSocketChunkChars));
      resetIdleTimeout();
    });

    child.on('error', (error: Error) => {
      clearTimeout(timeout);
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }
      reject(error);
    });

    child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timeout);
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
      }

      const runtimeMs = Date.now() - startTime;
      const truncatedStdout = truncateOutput(stdout.trim(), resolvedConfig.maxOutputChars);
      const truncatedStderr = truncateOutput(stderr.trim(), resolvedConfig.maxOutputChars);

      if (timeoutReason === 'timeout') {
        const timeoutError = new Error(`Claude CLI command timed out after ${resolvedConfig.timeoutMs}ms`);
        emitTaskLog(task.id, task.agentId, 'system', timeoutError.message);
        return reject(timeoutError);
      }

      if (timeoutReason === 'idle_timeout') {
        const timeoutError = new Error(`Claude CLI command was terminated after ${resolvedConfig.idleTimeoutMs}ms of inactivity`);
        emitTaskLog(task.id, task.agentId, 'system', timeoutError.message);
        return reject(timeoutError);
      }

      if (exitCode === null) {
        const signalMessage = signal
          ? `Claude CLI terminated by signal ${signal}`
          : 'Claude CLI exited without an exit code';
        emitTaskLog(task.id, task.agentId, 'system', signalMessage);
        return reject(new Error(signalMessage));
      }

      if (exitCode !== 0) {
        const stderrSummary = truncatedStderr.value || 'No stderr output captured';
        emitTaskLog(task.id, task.agentId, 'system', `Claude CLI failed with exit code ${exitCode}`);
        return reject(new Error(`Claude CLI failed with exit code ${exitCode}: ${stderrSummary}`));
      }

      const message = truncatedStdout.value.length > 0
        ? truncatedStdout.value
        : 'Claude CLI completed with no stdout output.';

      if (task.runId && task.conversationId) {
        appendRunEvent({
          runId: task.runId,
          conversationId: task.conversationId,
          type: 'tool.result',
          payload: {
            toolName: 'claude_cli',
            output: {
              exitCode: exitCode ?? 0,
              signal,
              durationMs: runtimeMs
            }
          }
        });
      }

      emitTaskLog(task.id, task.agentId, 'system', `Claude CLI completed in ${runtimeMs}ms`);

      return resolve({
        message,
        finishReason: 'stop',
        metadata: {
          executionMode: 'claude_cli',
          command: resolvedConfig.command,
          args: resolvedConfig.args,
          workingDirectory: resolvedConfig.workingDirectory,
          durationMs: runtimeMs,
          exitCode: exitCode ?? 0,
          signal,
          truncatedOutput: truncatedStdout.truncated || truncatedStderr.truncated
        },
        stdout: truncatedStdout.value,
        stderr: truncatedStderr.value
      });
    });
  });
}
