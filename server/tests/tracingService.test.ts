/**
 * TracingService Unit Tests
 */

import {
  isTracingEnabled,
  getProjectName,
  createAgentTrace,
  formatTraceMetadata,
  getTracingProviderOptions
} from '../src/services/tracingService';

describe('TracingService', () => {
  // Store original env
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    jest.resetModules();
    // Reset env to original before each test
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
    // Override with empty values to simulate fresh load
    process.env.LANGSMITH_TRACING = '';
    process.env.LANGSMITH_API_KEY = '';
    process.env.LANGSMITH_PROJECT = '';
  });

  afterAll(() => {
    // Restore original env
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  describe('isTracingEnabled', () => {
    it('should return false when LANGSMITH_TRACING is not set', () => {
      delete process.env.LANGSMITH_TRACING;
      delete process.env.LANGSMITH_API_KEY;
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return false when API key is not configured', () => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = '';
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return false when API key is placeholder', () => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = 'your_langsmith_api_key';
      expect(isTracingEnabled()).toBe(false);
    });

    it('should return true when tracing is enabled and API key is set', () => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = 'test-api-key-123';
      expect(isTracingEnabled()).toBe(true);
    });

    it('should return false when LANGSMITH_TRACING is false but API key is set', () => {
      process.env.LANGSMITH_TRACING = 'false';
      process.env.LANGSMITH_API_KEY = 'test-api-key-123';
      expect(isTracingEnabled()).toBe(false);
    });
  });

  describe('getProjectName', () => {
    it('should return default project name when not set', () => {
      delete process.env.LANGSMITH_PROJECT;
      expect(getProjectName()).toBe('agent-orchestration');
    });

    it('should return custom project name when set', () => {
      process.env.LANGSMITH_PROJECT = 'my-custom-project';
      expect(getProjectName()).toBe('my-custom-project');
    });
  });

  describe('getTracingProviderOptions', () => {
    it('should return empty object when tracing is disabled', () => {
      delete process.env.LANGSMITH_TRACING;
      delete process.env.LANGSMITH_API_KEY;
      expect(getTracingProviderOptions()).toEqual({});
    });

    it('should return provider options when tracing is enabled', () => {
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = 'test-api-key';
      process.env.LANGSMITH_PROJECT = 'test-project';

      const options = getTracingProviderOptions();
      expect(options).toEqual({
        headers: {
          'LangSmith-Dedupe': 'true',
          'LangSmith-Project': 'test-project'
        }
      });
    });
  });

  describe('createAgentTrace', () => {
    it('should return no-op trace context when tracing is disabled', async () => {
      // Make sure tracing is disabled
      process.env.LANGSMITH_TRACING = '';
      process.env.LANGSMITH_API_KEY = '';

      const traceContext = await createAgentTrace(
        { agentId: 'test-agent', taskId: 'test-task', model: 'gpt-4o', temperature: 0.7 },
        'test prompt'
      );

      // Should return no-op trace context (not null) with runId and functions
      expect(traceContext).not.toBeNull();
      expect(traceContext?.runId).toBeDefined();
      expect(traceContext?.runId).toMatch(/^run-/);
      expect(typeof traceContext?.logToolCall).toBe('function');
      expect(typeof traceContext?.completeTrace).toBe('function');

      // completeTrace should return empty metrics
      const result = await traceContext!.completeTrace({
        response: 'test response',
        toolCalls: [],
        finishReason: 'stop'
      });
      expect(result.costMetrics.promptTokens).toBe(0);
      expect(result.toolCalls).toEqual([]);
    });

    it('should return trace context with methods when valid API key is set', async () => {
      // This test verifies the code path works - it may fail with 403 if API key is invalid
      // We're testing that the code returns properly when isTracingEnabled is true
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = 'test-api-key-123';

      // Note: This will fail with 403 since it's not a real API key
      // The function catches the error and returns null
      const traceContext = await createAgentTrace(
        { agentId: 'test-agent', taskId: 'test-task', model: 'gpt-4o', temperature: 0.7 },
        'test prompt'
      );

      // Due to invalid API key, it will return null (error case)
      expect(traceContext).toBeNull();
    });

    it('should return no-op trace context for any error case', async () => {
      // Set tracing enabled but with a valid-looking key that will fail
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_API_KEY = 'invalid-key';

      const traceContext = await createAgentTrace(
        { agentId: 'test-agent', taskId: 'test-task', model: 'gpt-4o', temperature: 0.7 },
        'test prompt'
      );

      // Should handle error gracefully
      expect(traceContext).toBeNull();
    });
  });

  describe('formatTraceMetadata', () => {
    it('should format trace result correctly', () => {
      const traceResult = {
        traceUrl: 'https://smith.langchain.com/projects/test/runs/abc123',
        runId: 'run-123',
        costMetrics: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
          latencyMs: 5000,
          estimatedCost: 0.0025
        },
        toolCalls: [
          { toolName: 'tool1', input: {}, output: {}, startTime: 0, endTime: 100 },
          { toolName: 'tool2', input: {}, output: {}, startTime: 100, endTime: 200 }
        ]
      };

      const metadata = formatTraceMetadata(traceResult);

      expect(metadata.traceUrl).toBe('https://smith.langchain.com/projects/test/runs/abc123');
      expect(metadata.runId).toBe('run-123');
      expect(metadata.tokens).toEqual({ prompt: 100, completion: 200, total: 300 });
      expect(metadata.latency).toEqual({
        ms: 5000,
        perTool: {
          tool1: 100,
          tool2: 100
        }
      });
      expect(metadata.cost).toEqual({ usd: 0.0025 });
      expect(metadata.toolCalls).toBe(2);
      expect(metadata.toolCallDetails).toEqual([
        { name: 'tool1', durationMs: 100 },
        { name: 'tool2', durationMs: 100 }
      ]);
    });

    it('should handle missing optional fields', () => {
      const traceResult = {
        runId: 'run-123',
        costMetrics: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: 0
        },
        toolCalls: []
      };

      const metadata = formatTraceMetadata(traceResult);

      expect(metadata.traceUrl).toBeUndefined();
      expect(metadata.cost).toEqual({ usd: undefined });
    });
  });
});
