/**
 * ProductionReadinessService
 * Builds a staged rollout readiness report from runtime checks and policies.
 */

import { getFeatureFlags } from '../../types';
import { getReadinessSnapshot } from './readinessService';
import { getRuntimePolicySnapshot } from './runtimePolicyService';
import { getDeadLetterSnapshot } from './deadLetterQueueService';
import { getCircuitBreakerSnapshot } from './circuitBreakerService';

export interface ReadinessGate {
  name: string;
  passed: boolean;
  detail: string;
}

export interface RolloutStage {
  name: string;
  status: 'ready' | 'blocked';
  gates: ReadinessGate[];
}

export interface ProductionReadinessReport {
  status: 'ready' | 'blocked';
  generatedAt: string;
  stages: RolloutStage[];
  dependencies: Awaited<ReturnType<typeof getReadinessSnapshot>>;
  runtimePolicies: ReturnType<typeof getRuntimePolicySnapshot>;
  featureFlags: ReturnType<typeof getFeatureFlags>;
  reliability: {
    deadLetterQueue: ReturnType<typeof getDeadLetterSnapshot>;
    circuitBreakers: ReturnType<typeof getCircuitBreakerSnapshot>;
  };
}

function stageStatus(gates: ReadinessGate[]): 'ready' | 'blocked' {
  return gates.every((gate) => gate.passed) ? 'ready' : 'blocked';
}

function createStage(name: string, gates: ReadinessGate[]): RolloutStage {
  return {
    name,
    status: stageStatus(gates),
    gates
  };
}

export async function getProductionReadinessReport(): Promise<ProductionReadinessReport> {
  const dependencies = await getReadinessSnapshot();
  const runtimePolicies = getRuntimePolicySnapshot();
  const featureFlags = getFeatureFlags();
  const deadLetterQueue = getDeadLetterSnapshot();
  const circuitBreakers = getCircuitBreakerSnapshot();

  const foundationStage = createStage('foundation', [
    {
      name: 'dependency-health',
      passed: dependencies.status === 'ok',
      detail: dependencies.status === 'ok' ? 'All core dependencies are healthy' : 'One or more dependencies are degraded'
    },
    {
      name: 'worker-concurrency',
      passed: runtimePolicies.connections.worker.concurrency >= 1,
      detail: `Worker concurrency is ${runtimePolicies.connections.worker.concurrency}`
    }
  ]);

  const integrationsStage = createStage('integrations', [
    {
      name: 'mcp-flag',
      passed: featureFlags.FEATURE_MCP_SDK_CLIENT,
      detail: featureFlags.FEATURE_MCP_SDK_CLIENT
        ? 'MCP SDK integrations enabled'
        : 'Enable FEATURE_MCP_SDK_CLIENT for integration rollout'
    },
    {
      name: 'provider-flag',
      passed: featureFlags.FEATURE_PROVIDER_TOOLS && featureFlags.FEATURE_EXTERNAL_AI_PROVIDERS,
      detail: (featureFlags.FEATURE_PROVIDER_TOOLS && featureFlags.FEATURE_EXTERNAL_AI_PROVIDERS)
        ? 'External providers enabled'
        : 'Enable FEATURE_PROVIDER_TOOLS + FEATURE_EXTERNAL_AI_PROVIDERS'
    }
  ]);

  const resilienceStage = createStage('resilience', [
    {
      name: 'http-rate-limit',
      passed: featureFlags.FEATURE_HTTP_RATE_LIMIT,
      detail: featureFlags.FEATURE_HTTP_RATE_LIMIT
        ? 'HTTP rate limiting enabled'
        : 'Enable FEATURE_HTTP_RATE_LIMIT'
    },
    {
      name: 'circuit-breakers',
      passed: featureFlags.FEATURE_CIRCUIT_BREAKERS,
      detail: featureFlags.FEATURE_CIRCUIT_BREAKERS
        ? 'Circuit breaker protections enabled'
        : 'Enable FEATURE_CIRCUIT_BREAKERS'
    },
    {
      name: 'dead-letter-queue',
      passed: featureFlags.FEATURE_DEAD_LETTER_QUEUE,
      detail: featureFlags.FEATURE_DEAD_LETTER_QUEUE
        ? `DLQ enabled (${deadLetterQueue.pending} pending entries)`
        : 'Enable FEATURE_DEAD_LETTER_QUEUE'
    }
  ]);

  const rolloutStage = createStage('staged-rollout', [
    {
      name: 'advanced-dag',
      passed: featureFlags.FEATURE_ADVANCED_DAG,
      detail: featureFlags.FEATURE_ADVANCED_DAG
        ? 'DAG orchestration enabled'
        : 'Enable FEATURE_ADVANCED_DAG for advanced plan rollout'
    },
    {
      name: 'dynamic-pools',
      passed: featureFlags.FEATURE_DYNAMIC_AGENT_POOLS,
      detail: featureFlags.FEATURE_DYNAMIC_AGENT_POOLS
        ? 'Dynamic pool assignment enabled'
        : 'Enable FEATURE_DYNAMIC_AGENT_POOLS for load-aware assignment'
    }
  ]);

  const stages = [foundationStage, integrationsStage, resilienceStage, rolloutStage];

  return {
    status: stages.every((stage) => stage.status === 'ready') ? 'ready' : 'blocked',
    generatedAt: new Date().toISOString(),
    stages,
    dependencies,
    runtimePolicies,
    featureFlags,
    reliability: {
      deadLetterQueue,
      circuitBreakers
    }
  };
}
