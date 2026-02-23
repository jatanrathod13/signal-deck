/**
 * Orchestration SDK client
 * Minimal TypeScript client for key orchestration endpoints.
 */

interface ClientOptions {
  baseUrl: string;
  workspaceId?: string;
  apiKey?: string;
  timeoutMs?: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export interface SubmitTaskInput {
  agentId: string;
  type: string;
  data?: Record<string, unknown>;
  priority?: number;
  executionMode?: 'tool_loop' | 'claude_cli';
}

export interface DagPlanStepInput {
  id?: string;
  title: string;
  description?: string;
  agentId?: string;
  taskType?: string;
  taskData?: Record<string, unknown>;
  dependsOnStepIds?: string[];
}

export interface CreateDagPlanInput {
  objective: string;
  defaultAgentId: string;
  steps: DagPlanStepInput[];
  teamAgentIds?: string[];
  assignmentStrategy?: 'round_robin' | 'least_loaded';
  executionMode?: 'tool_loop' | 'claude_cli';
}

export class OrchestrationClient {
  private readonly baseUrl: string;
  private readonly workspaceId?: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.workspaceId = options.workspaceId;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.workspaceId) {
        headers['x-workspace-id'] = this.workspaceId;
      }

      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      const payload = await response.json() as ApiEnvelope<T>;
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error ?? `Request failed with status ${response.status}`);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
        return payload.data as T;
      }

      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  getReadinessReview(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/system/readiness/review');
  }

  listAgents(): Promise<Array<Record<string, unknown>>> {
    return this.request<Array<Record<string, unknown>>>('/api/agents');
  }

  submitTask(input: SubmitTaskInput): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/tasks', {
      method: 'POST',
      body: input
    });
  }

  createDagPlan(input: CreateDagPlanInput): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/plans/dag', {
      method: 'POST',
      body: input
    });
  }
}
