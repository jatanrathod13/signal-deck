/**
 * RunIntelligenceService - Timeline analysis for run events.
 * Implements WP-10: Run intelligence timeline UI (backend).
 *
 * Converts raw run events into grouped phases with bottleneck and failure insights.
 */

import {
  RunEvent,
  RunIntelligence,
  RunPhase,
  RouteDecision
} from '../../types';
import { listRunEvents, getRun } from './conversationService';

/**
 * Phase grouping rules based on event type prefixes.
 */
const PHASE_MAPPINGS: Record<string, string> = {
  'run.started': 'Initialization',
  'run.completed': 'Completion',
  'run.failed': 'Completion',
  'research.source': 'Research Discovery',
  'research.finding': 'Research Analysis',
  'tool.call': 'Tool Execution',
  'tool.result': 'Tool Execution',
  'tool.error': 'Tool Execution',
  'model.route.selected': 'Model Routing',
  'evaluation.completed': 'Evaluation',
  'approval.requested': 'Governance',
  'approval.resolved': 'Governance',
  'plan.created': 'Planning',
  'plan.step.status': 'Planning',
  'message.created': 'Response Generation',
  'message.delta': 'Response Generation',
  'task.status': 'Task Execution',
  'stream.resumed': 'Stream Recovery'
};

/**
 * Build RunIntelligence from raw run events.
 */
export function buildRunIntelligence(runId: string): RunIntelligence | undefined {
  const run = getRun(runId);
  if (!run) {
    return undefined;
  }

  const events = listRunEvents(runId);
  if (events.length === 0) {
    return {
      runId,
      phases: [],
      toolFailureSummary: [],
      routeSummary: [],
      totalDurationMs: 0
    };
  }

  // Sort events chronologically
  const sorted = [...events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group events into phases
  const phaseMap = new Map<string, {
    events: RunEvent[];
    startedAt: Date;
    endedAt?: Date;
  }>();

  for (const event of sorted) {
    const phaseName = PHASE_MAPPINGS[event.type] || 'Other';
    const existing = phaseMap.get(phaseName);
    const eventTime = new Date(event.timestamp);

    if (existing) {
      existing.events.push(event);
      if (!existing.endedAt || eventTime.getTime() > existing.endedAt.getTime()) {
        existing.endedAt = eventTime;
      }
    } else {
      phaseMap.set(phaseName, {
        events: [event],
        startedAt: eventTime,
        endedAt: eventTime
      });
    }
  }

  // Convert to RunPhase array
  const phases: RunPhase[] = Array.from(phaseMap.entries()).map(([name, data]) => {
    const startTime = data.startedAt.getTime();
    const endTime = data.endedAt?.getTime() ?? startTime;
    const hasFailure = data.events.some((e) =>
      e.type === 'tool.error' || e.type === 'run.failed'
    );

    return {
      name,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      durationMs: endTime - startTime,
      eventCount: data.events.length,
      status: hasFailure ? 'failed' : (data.endedAt ? 'completed' : 'running')
    };
  });

  // Sort phases by start time
  phases.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

  // Identify bottleneck (longest phase)
  const bottleneckPhase = phases.reduce((max, phase) =>
    (phase.durationMs ?? 0) > (max.durationMs ?? 0) ? phase : max
  , phases[0]);

  const bottleneck = bottleneckPhase && (bottleneckPhase.durationMs ?? 0) > 0
    ? {
        phaseName: bottleneckPhase.name,
        durationMs: bottleneckPhase.durationMs ?? 0,
        reason: `Longest phase with ${bottleneckPhase.eventCount} events`
      }
    : undefined;

  // Summarize tool failures
  const toolErrors: Record<string, { count: number; lastError: string }> = {};
  for (const event of sorted) {
    if (event.type === 'tool.error') {
      const toolName = typeof event.payload.toolName === 'string'
        ? event.payload.toolName
        : 'unknown';
      const errorMsg = typeof event.payload.error === 'string'
        ? event.payload.error
        : 'Unknown error';

      if (!toolErrors[toolName]) {
        toolErrors[toolName] = { count: 0, lastError: '' };
      }
      toolErrors[toolName].count++;
      toolErrors[toolName].lastError = errorMsg;
    }
  }

  const toolFailureSummary = Object.entries(toolErrors).map(([toolName, data]) => ({
    toolName,
    errorCount: data.count,
    lastError: data.lastError
  }));

  // Extract route decisions
  const routeSummary: RouteDecision[] = sorted
    .filter((e) => e.type === 'model.route.selected')
    .map((e) => ({
      stepId: typeof e.payload.stepId === 'string' ? e.payload.stepId : undefined,
      selectedModel: typeof e.payload.selectedModel === 'string' ? e.payload.selectedModel : 'unknown',
      reason: typeof e.payload.reason === 'string' ? e.payload.reason : '',
      taskClass: typeof e.payload.taskClass === 'string' ? e.payload.taskClass : undefined,
      decidedAt: new Date(e.timestamp)
    }));

  // Calculate total duration
  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];
  const totalDurationMs = new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime();

  return {
    runId,
    phases,
    bottleneck,
    toolFailureSummary,
    routeSummary,
    totalDurationMs
  };
}
