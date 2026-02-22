/**
 * DeepResearchService - Multi-phase research orchestration.
 * Implements WP-04: Deep research orchestration phases.
 *
 * Phases: discover → extract → cross-check → synthesize
 */

import {
  ResearchConfig,
  ResearchSource,
  ResearchFinding,
  RunArtifacts
} from '../../types';
import { appendRunEvent } from './conversationService';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Phase 1: Discover — Identify relevant sources for the research query.
 */
export async function discoverSources(
  query: string,
  config: ResearchConfig,
  context: { runId: string; conversationId: string }
): Promise<ResearchSource[]> {
  const maxSources = config.maxSources ?? 10;

  // In production, this would call search APIs, knowledge bases, etc.
  // For now, we generate structured placeholders demonstrating the pipeline.
  const sources: ResearchSource[] = [];

  // Simulate discovering sources based on query analysis
  const queryParts = query.split(/\s+/).filter((w) => w.length > 3);
  const sourceCount = Math.min(maxSources, Math.max(3, queryParts.length));

  for (let i = 0; i < sourceCount; i++) {
    const source: ResearchSource = {
      id: generateId('src'),
      title: `Research source ${i + 1} for: ${query.slice(0, 50)}`,
      snippet: `Relevant content excerpt related to "${queryParts[i % queryParts.length] || query.slice(0, 20)}"...`,
      confidence: 0.5 + Math.random() * 0.5,
      retrievedAt: new Date()
    };

    sources.push(source);

    // Emit source discovery event
    appendRunEvent({
      runId: context.runId,
      conversationId: context.conversationId,
      type: 'research.source',
      payload: {
        sourceId: source.id,
        title: source.title,
        confidence: source.confidence,
        phase: 'discover'
      }
    });
  }

  return sources;
}

/**
 * Phase 2: Extract — Pull key findings from discovered sources.
 */
export async function extractFindings(
  sources: ResearchSource[],
  query: string,
  context: { runId: string; conversationId: string }
): Promise<ResearchFinding[]> {
  const findings: ResearchFinding[] = [];

  // Group sources and extract claims
  const groupSize = Math.max(1, Math.floor(sources.length / 3));
  const groups = [];
  for (let i = 0; i < sources.length; i += groupSize) {
    groups.push(sources.slice(i, i + groupSize));
  }

  for (const [groupIndex, group] of groups.entries()) {
    const finding: ResearchFinding = {
      id: generateId('finding'),
      claim: `Finding ${groupIndex + 1}: Analysis of ${group.length} sources regarding "${query.slice(0, 40)}"`,
      sources: group.map((s) => s.id),
      confidence: group.reduce((sum, s) => sum + s.confidence, 0) / group.length,
      crossChecked: false
    };

    findings.push(finding);

    appendRunEvent({
      runId: context.runId,
      conversationId: context.conversationId,
      type: 'research.finding',
      payload: {
        findingId: finding.id,
        claim: finding.claim,
        sourceCount: finding.sources.length,
        confidence: finding.confidence,
        phase: 'extract'
      }
    });
  }

  return findings;
}

/**
 * Phase 3: Cross-check — Verify findings across multiple sources.
 */
export async function crossCheckFindings(
  findings: ResearchFinding[],
  sources: ResearchSource[],
  context: { runId: string; conversationId: string }
): Promise<ResearchFinding[]> {
  const sourcePerId = new Map(sources.map((s) => [s.id, s]));

  return findings.map((finding) => {
    // Cross-check: verify the finding's sources have sufficient confidence
    const sourceConfidences = finding.sources
      .map((sid) => sourcePerId.get(sid)?.confidence ?? 0)
      .filter((c) => c > 0);

    const avgSourceConfidence = sourceConfidences.length > 0
      ? sourceConfidences.reduce((a, b) => a + b, 0) / sourceConfidences.length
      : 0;

    const crossChecked = avgSourceConfidence > 0.6 && sourceConfidences.length >= 2;
    const adjustedConfidence = crossChecked
      ? Math.min(1, finding.confidence * 1.2)
      : finding.confidence * 0.8;

    const updated: ResearchFinding = {
      ...finding,
      crossChecked,
      confidence: adjustedConfidence
    };

    appendRunEvent({
      runId: context.runId,
      conversationId: context.conversationId,
      type: 'research.finding',
      payload: {
        findingId: updated.id,
        crossChecked: updated.crossChecked,
        confidence: updated.confidence,
        phase: 'cross-check'
      }
    });

    return updated;
  });
}

/**
 * Phase 4: Synthesize — Combine findings into structured research artifacts.
 */
export async function synthesizeResearch(
  sources: ResearchSource[],
  findings: ResearchFinding[],
  query: string,
  _context: { runId: string; conversationId: string }
): Promise<RunArtifacts> {
  // Build citation map
  const citationMap: Record<string, string[]> = {};
  for (const finding of findings) {
    citationMap[finding.id] = finding.sources;
  }

  // Calculate confidence summary
  const findingConfidences: Record<string, number> = {};
  for (const finding of findings) {
    findingConfidences[finding.id] = finding.confidence;
  }

  const overallConfidence = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
    : 0;

  return {
    sources,
    findings,
    citationMap,
    confidenceSummary: {
      overall: overallConfidence,
      perFinding: findingConfidences
    }
  };
}

/**
 * Execute the full deep research pipeline.
 */
export async function executeDeepResearch(
  query: string,
  config: ResearchConfig,
  context: { runId: string; conversationId: string }
): Promise<RunArtifacts> {
  // Phase 1: Discover
  const sources = await discoverSources(query, config, context);

  // Phase 2: Extract
  const rawFindings = await extractFindings(sources, query, context);

  // Phase 3: Cross-check
  const verifiedFindings = await crossCheckFindings(rawFindings, sources, context);

  // Phase 4: Synthesize
  const artifacts = await synthesizeResearch(sources, verifiedFindings, query, context);

  return artifacts;
}
