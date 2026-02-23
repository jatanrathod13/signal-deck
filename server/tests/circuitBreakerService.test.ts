import { executeWithCircuitBreaker, getCircuitBreakerSnapshot, resetCircuitBreakers } from '../src/services/circuitBreakerService';

describe('circuitBreakerService', () => {
  beforeEach(() => {
    process.env.FEATURE_CIRCUIT_BREAKERS = 'true';
    process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '2';
    process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS = '50';
    process.env.CIRCUIT_BREAKER_OPERATION_TIMEOUT_MS = '1000';
    resetCircuitBreakers();
  });

  afterEach(() => {
    delete process.env.FEATURE_CIRCUIT_BREAKERS;
    delete process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    delete process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS;
    delete process.env.CIRCUIT_BREAKER_OPERATION_TIMEOUT_MS;
    resetCircuitBreakers();
  });

  it('opens the circuit after threshold failures', async () => {
    await expect(executeWithCircuitBreaker('test.service', async () => {
      throw new Error('boom-1');
    })).rejects.toThrow('boom-1');

    await expect(executeWithCircuitBreaker('test.service', async () => {
      throw new Error('boom-2');
    })).rejects.toThrow('boom-2');

    await expect(executeWithCircuitBreaker('test.service', async () => 'ok'))
      .rejects.toThrow('open');

    const snapshot = getCircuitBreakerSnapshot();
    expect(snapshot[0].state).toBe('open');
  });

  it('bypasses breaker logic when feature flag is disabled', async () => {
    process.env.FEATURE_CIRCUIT_BREAKERS = 'false';

    const result = await executeWithCircuitBreaker('disabled.service', async () => 'ok');
    expect(result).toBe('ok');
  });
});
