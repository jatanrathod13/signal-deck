/**
 * ApiDocsService
 * Provides a lightweight OpenAPI document for key platform endpoints.
 */

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  paths: Record<string, unknown>;
  generatedAt: string;
}

export function getOpenApiDocument(baseUrl?: string): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Agent Orchestration Platform API',
      version: '1.0.0-phase6',
      description: 'Core runtime, orchestration, and reliability endpoints.'
    },
    servers: [
      {
        url: baseUrl ?? process.env.API_BASE_URL ?? 'http://localhost:3001'
      }
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Basic liveness check'
        }
      },
      '/ready': {
        get: {
          summary: 'Dependency readiness snapshot'
        }
      },
      '/api/tasks': {
        post: {
          summary: 'Submit a task'
        },
        get: {
          summary: 'List tasks in workspace scope'
        }
      },
      '/api/plans': {
        post: {
          summary: 'Create/start a sequential or parallel plan'
        },
        get: {
          summary: 'List plans'
        }
      },
      '/api/plans/dag': {
        post: {
          summary: 'Create/start a DAG orchestration plan'
        }
      },
      '/api/tools/catalog': {
        get: {
          summary: 'Inspect effective tool catalog and flags'
        }
      },
      '/api/system/integrations': {
        get: {
          summary: 'List integration templates (IoT/MCP/provider)'
        }
      },
      '/api/system/dlq': {
        get: {
          summary: 'List dead letter queue entries'
        }
      },
      '/api/system/readiness/review': {
        get: {
          summary: 'Production readiness review snapshot'
        }
      },
      '/api/system/openapi.json': {
        get: {
          summary: 'OpenAPI document'
        }
      }
    },
    generatedAt: new Date().toISOString()
  };
}
