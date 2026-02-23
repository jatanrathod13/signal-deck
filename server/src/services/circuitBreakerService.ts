/**
 * CircuitBreakerService
 * Guards unstable external dependencies and prevents cascading failures.
 */

import { getFeatureFlags } from '../../types';

type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  timeoutMs: number;
}

interface CircuitStats {
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
  openedAt?: number;
  openedBy?: string;
  lastFailureAt?: number;
  lastFailureReason?: string;
}

interface CircuitInstance {
  state: CircuitState;
  options: CircuitBreakerOptions;
  stats: CircuitStats;
  halfOpenInFlight: number;
}

export interface CircuitSnapshot {
  name: string;
  state: CircuitState;
  options: CircuitBreakerOptions;
  stats: CircuitStats;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getDefaultOptions(): CircuitBreakerOptions {
  return {
    failureThreshold: parsePositiveInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD, 3),
    resetTimeoutMs: parsePositiveInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS, 30_000),
    halfOpenMaxCalls: parsePositiveInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS, 1),
    timeoutMs: parsePositiveInt(process.env.CIRCUIT_BREAKER_OPERATION_TIMEOUT_MS, 20_000)
  };
}

const circuits = new Map<string, CircuitInstance>();

function now(): number {
  return Date.now();
}

function getOrCreateCircuit(name: string, overrides?: Partial<CircuitBreakerOptions>): CircuitInstance {
  const existing = circuits.get(name);
  if (existing) {
    if (overrides) {
      existing.options = {
        ...existing.options,
        ...overrides
      };
    }
    return existing;
  }

  const circuit: CircuitInstance = {
    state: 'closed',
    options: {
      ...getDefaultOptions(),
      ...(overrides ?? {})
    },
    stats: {
      failures: 0,
      successes: 0,
      rejects: 0,
      timeouts: 0
    },
    halfOpenInFlight: 0
  };

  circuits.set(name, circuit);
  return circuit;
}

function moveToOpen(circuit: CircuitInstance, reason: string): void {
  circuit.state = 'open';
  circuit.stats.openedAt = now();
  circuit.stats.openedBy = reason;
}

function moveToClosed(circuit: CircuitInstance): void {
  circuit.state = 'closed';
  circuit.halfOpenInFlight = 0;
  circuit.stats.failures = 0;
  circuit.stats.openedAt = undefined;
  circuit.stats.openedBy = undefined;
}

function maybeTransitionFromOpen(circuit: CircuitInstance): void {
  if (circuit.state !== 'open') {
    return;
  }

  const openedAt = circuit.stats.openedAt;
  if (!openedAt) {
    circuit.state = 'half_open';
    return;
  }

  if (now() - openedAt >= circuit.options.resetTimeoutMs) {
    circuit.state = 'half_open';
    circuit.halfOpenInFlight = 0;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Circuit breaker operation timed out after ${timeoutMs}ms`));
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

export async function executeWithCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  overrides?: Partial<CircuitBreakerOptions>
): Promise<T> {
  const flags = getFeatureFlags();
  if (!flags.FEATURE_CIRCUIT_BREAKERS) {
    return operation();
  }

  const circuit = getOrCreateCircuit(name, overrides);
  maybeTransitionFromOpen(circuit);

  if (circuit.state === 'open') {
    circuit.stats.rejects += 1;
    throw new Error(`Circuit ${name} is open`);
  }

  if (circuit.state === 'half_open' && circuit.halfOpenInFlight >= circuit.options.halfOpenMaxCalls) {
    circuit.stats.rejects += 1;
    throw new Error(`Circuit ${name} is half-open and at probe capacity`);
  }

  if (circuit.state === 'half_open') {
    circuit.halfOpenInFlight += 1;
  }

  try {
    const result = await withTimeout(operation(), circuit.options.timeoutMs);

    circuit.stats.successes += 1;
    if (circuit.state === 'half_open') {
      moveToClosed(circuit);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    circuit.stats.failures += 1;
    circuit.stats.lastFailureAt = now();
    circuit.stats.lastFailureReason = message;

    if (message.toLowerCase().includes('timed out')) {
      circuit.stats.timeouts += 1;
    }

    if (circuit.state === 'half_open' || circuit.stats.failures >= circuit.options.failureThreshold) {
      moveToOpen(circuit, message);
    }

    throw error;
  } finally {
    if (circuit.state === 'half_open' && circuit.halfOpenInFlight > 0) {
      circuit.halfOpenInFlight -= 1;
    }
  }
}

export function getCircuitBreakerSnapshot(): CircuitSnapshot[] {
  return Array.from(circuits.entries()).map(([name, circuit]) => ({
    name,
    state: circuit.state,
    options: { ...circuit.options },
    stats: {
      ...circuit.stats
    }
  }));
}

export function resetCircuitBreakers(): void {
  circuits.clear();
}
