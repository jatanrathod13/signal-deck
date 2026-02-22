/**
 * MetricsService
 * Lightweight in-memory KPI counters for orchestration visibility.
 */

export interface MetricsSnapshot {
  tasksSubmitted: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksCancelled: number;
  toolCalls: number;
  toolFailures: number;
  plansCreated: number;
  planStepsCompleted: number;
  planStepsFailed: number;
  startedAt: Date;
}

const metrics: Omit<MetricsSnapshot, 'startedAt'> = {
  tasksSubmitted: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  tasksCancelled: 0,
  toolCalls: 0,
  toolFailures: 0,
  plansCreated: 0,
  planStepsCompleted: 0,
  planStepsFailed: 0
};

const startedAt = new Date();

export function incrementMetric(key: keyof typeof metrics, value: number = 1): void {
  metrics[key] += value;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return {
    ...metrics,
    startedAt
  };
}

export function resetMetrics(): void {
  for (const key of Object.keys(metrics) as Array<keyof typeof metrics>) {
    metrics[key] = 0;
  }
}
