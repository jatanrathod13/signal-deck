/**
 * Logger
 * Structured JSON logger for server and request lifecycle events.
 */

import pino, { Logger } from 'pino';

function parseLogLevel(): pino.LevelWithSilent {
  const candidate = process.env.LOG_LEVEL;
  if (!candidate) {
    return 'info';
  }

  const normalized = candidate.toLowerCase();
  if (
    normalized === 'fatal' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'info' ||
    normalized === 'debug' ||
    normalized === 'trace' ||
    normalized === 'silent'
  ) {
    return normalized;
  }

  return 'info';
}

export const logger: Logger = pino({
  name: 'agent-orchestration-server',
  level: parseLogLevel(),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
});
