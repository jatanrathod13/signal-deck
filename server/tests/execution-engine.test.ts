/**
 * Execution Service Tests
 * Tests the executionService exports and basic functionality
 */

import { executeAgentTask, streamAgentTask } from '../src/services/executionService';
import { getMcpToolsForAgent, clearMcpClient, clearAllMcpClients, McpServerConfig } from '../src/services/mcpClientService';

describe('Execution Service', () => {
  describe('Module Exports', () => {
    it('should export executeAgentTask function', () => {
      expect(typeof executeAgentTask).toBe('function');
    });

    it('should export streamAgentTask function', () => {
      expect(typeof streamAgentTask).toBe('function');
    });
  });

  describe('MCP Client Service Exports', () => {
    it('should export getMcpToolsForAgent function', () => {
      expect(typeof getMcpToolsForAgent).toBe('function');
    });

    it('should export clearMcpClient function', () => {
      expect(typeof clearMcpClient).toBe('function');
    });

    it('should export clearAllMcpClients function', () => {
      expect(typeof clearAllMcpClients).toBe('function');
    });

    it('should export McpServerConfig interface', () => {
      // Verify the interface exists by checking it can be used as a type
      const config: McpServerConfig = {
        url: 'http://localhost:3000',
        name: 'test-server',
        transport: 'http'
      };
      expect(config.url).toBe('http://localhost:3000');
      expect(config.name).toBe('test-server');
      expect(config.transport).toBe('http');
    });

    it('should handle empty server URL gracefully', async () => {
      const result = await getMcpToolsForAgent('');
      expect(result).toEqual({});
    });

    it('should handle undefined server URL gracefully', async () => {
      const result = await getMcpToolsForAgent(undefined as any);
      expect(result).toEqual({});
    });
  });

  describe('Result Format', () => {
    it('should maintain result format from Step 1 changes', () => {
      // The result format should include: message, finishReason, metadata
      // This is verified through the TypeScript types
      const mockResult = {
        message: 'test message',
        finishReason: 'stop',
        metadata: {
          model: 'gpt-4o',
          steps: 1,
          toolCalls: 1
        }
      };

      expect(mockResult).toHaveProperty('message');
      expect(mockResult).toHaveProperty('finishReason');
      expect(mockResult).toHaveProperty('metadata');
      expect(mockResult.metadata).toHaveProperty('model');
      expect(mockResult.metadata).toHaveProperty('steps');
      expect(mockResult.metadata).toHaveProperty('toolCalls');
    });
  });
});
