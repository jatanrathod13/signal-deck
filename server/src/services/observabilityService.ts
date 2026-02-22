/**
 * ObservabilityService
 * Prometheus metrics registry for request-level telemetry.
 */

import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics
} from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'request_id'] as const,
  registers: [registry]
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry]
});

export interface RequestObservation {
  method: string;
  route: string;
  statusCode: number;
  requestId: string;
  durationMs: number;
}

export function observeHttpRequest(observation: RequestObservation): void {
  const statusCode = String(observation.statusCode);
  httpRequestsTotal.inc({
    method: observation.method,
    route: observation.route,
    status_code: statusCode,
    request_id: observation.requestId
  });

  httpRequestDurationSeconds.observe(
    {
      method: observation.method,
      route: observation.route,
      status_code: statusCode
    },
    observation.durationMs / 1000
  );
}

export async function getPrometheusMetrics(): Promise<string> {
  return registry.metrics();
}

export function getPrometheusContentType(): string {
  return registry.contentType;
}

export function resetPrometheusMetrics(): void {
  registry.resetMetrics();
}
