/**
 * ModelRoutingService - Dynamic model selection per step.
 * Implements WP-02: prepareStep model routing + route logging.
 */

import {
  ModelRoutingConfig,
  RouteDecision,
  RunEventType
} from '../../types';
import { appendRunEvent } from './conversationService';

const DEFAULT_CHEAP_MODEL = 'gpt-4o-mini';
const DEFAULT_COMPLEX_MODEL = 'gpt-4o';

/**
 * Classify a task prompt into a complexity class.
 */
export function classifyTaskComplexity(prompt: string): {
  taskClass: string;
  complexityScore: number;
  requiresTools: boolean;
} {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;

  // Heuristic markers for tool-heavy tasks
  const toolKeywords = ['search', 'browse', 'fetch', 'query', 'database', 'api', 'file', 'execute', 'run'];
  const requiresTools = toolKeywords.some((kw) => lower.includes(kw));

  // Heuristic markers for research / complex reasoning
  const complexKeywords = ['analyze', 'compare', 'research', 'synthesize', 'evaluate', 'design', 'architect', 'explain in detail'];
  const complexMatches = complexKeywords.filter((kw) => lower.includes(kw)).length;

  let taskClass = 'general';
  let complexityScore = 0.3;

  if (complexMatches >= 2 || wordCount > 200) {
    taskClass = 'complex';
    complexityScore = 0.8;
  } else if (requiresTools) {
    taskClass = 'tool_heavy';
    complexityScore = 0.5;
  } else if (wordCount < 20) {
    taskClass = 'simple';
    complexityScore = 0.1;
  }

  return { taskClass, complexityScore, requiresTools };
}

/**
 * Select the best model for a given step/task based on routing config.
 */
export function selectModel(
  prompt: string,
  routingConfig?: ModelRoutingConfig,
  overrideModel?: string
): RouteDecision {
  // If an override is explicitly provided, use it
  if (overrideModel) {
    return {
      selectedModel: overrideModel,
      reason: 'Explicit model override from task configuration',
      decidedAt: new Date()
    };
  }

  const defaultModel = routingConfig?.defaultModel || DEFAULT_CHEAP_MODEL;

  if (!routingConfig) {
    return {
      selectedModel: defaultModel,
      reason: 'No routing config — using default model',
      decidedAt: new Date()
    };
  }

  const { taskClass, complexityScore, requiresTools } = classifyTaskComplexity(prompt);
  const threshold = routingConfig.complexityThreshold ?? 0.6;

  // 1. Check explicit task-class routes
  if (routingConfig.taskClassRoutes && routingConfig.taskClassRoutes[taskClass]) {
    return {
      selectedModel: routingConfig.taskClassRoutes[taskClass],
      reason: `Matched task class route: ${taskClass}`,
      taskClass,
      decidedAt: new Date()
    };
  }

  // 2. Check if tools are required and a special tool model is configured
  if (requiresTools && routingConfig.toolRequiredModel) {
    return {
      selectedModel: routingConfig.toolRequiredModel,
      reason: 'Task requires tool usage — using tool-optimized model',
      taskClass,
      decidedAt: new Date()
    };
  }

  // 3. Complexity threshold routing
  if (complexityScore >= threshold) {
    return {
      selectedModel: DEFAULT_COMPLEX_MODEL,
      reason: `Complexity score ${complexityScore.toFixed(2)} exceeds threshold ${threshold} — using complex model`,
      taskClass,
      decidedAt: new Date()
    };
  }

  // 4. Budget model for simple tasks
  if (complexityScore < 0.2 && routingConfig.budgetModel) {
    return {
      selectedModel: routingConfig.budgetModel,
      reason: 'Low complexity — using budget model',
      taskClass,
      decidedAt: new Date()
    };
  }

  return {
    selectedModel: defaultModel,
    reason: 'Default routing — no special conditions matched',
    taskClass,
    decidedAt: new Date()
  };
}

/**
 * Log a route decision as a run event.
 */
export function logRouteDecision(
  routeDecision: RouteDecision,
  context: {
    runId?: string;
    conversationId?: string;
    stepId?: string;
  }
): void {
  if (!context.runId || !context.conversationId) {
    return;
  }

  appendRunEvent({
    runId: context.runId,
    conversationId: context.conversationId,
    type: 'model.route.selected',
    payload: {
      selectedModel: routeDecision.selectedModel,
      reason: routeDecision.reason,
      taskClass: routeDecision.taskClass,
      stepId: context.stepId
    }
  });
}
