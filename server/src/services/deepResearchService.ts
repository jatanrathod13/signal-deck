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
import https from 'https';
import { appendRunEvent } from './conversationService';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface DiscoveryProvider {
  discover: (query: string, limit: number) => Promise<ResearchSource[]>;
  provider: string;
}

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{
      title?: string;
      snippet?: string;
      pageid?: number;
    }>;
  };
}

interface DuckDuckGoTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: DuckDuckGoTopic[];
}

interface DuckDuckGoResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  RelatedTopics?: DuckDuckGoTopic[];
}

function sanitizeSnippet(snippet: string): string {
  return snippet
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeConfidence(value: number): number {
  return Math.max(0.05, Math.min(1, value));
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'agent-orchestration-platform/1.0 (deep-research)'
        }
      },
      (response) => {
        const statusCode = response.statusCode ?? 500;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} for ${url}`));
          return;
        }

        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          data += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${String(error)}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(10_000, () => {
      request.destroy(new Error(`Timeout while requesting ${url}`));
    });
  });
}

async function discoverFromWikipedia(query: string, limit: number): Promise<ResearchSource[]> {
  const searchParams = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(Math.max(1, Math.min(limit, 20))),
    utf8: '1',
    format: 'json'
  });

  const endpoint = `https://en.wikipedia.org/w/api.php?${searchParams.toString()}`;
  const response = await fetchJson<WikipediaSearchResponse>(endpoint);
  const items = response.query?.search ?? [];

  return items.slice(0, limit).map((item, index) => {
    const title = item.title?.trim() || `Wikipedia result ${index + 1}`;
    const snippet = sanitizeSnippet(item.snippet || `Article related to ${query}`);
    const url = typeof item.pageid === 'number'
      ? `https://en.wikipedia.org/?curid=${item.pageid}`
      : undefined;

    return {
      id: generateId('src'),
      title,
      url,
      snippet,
      confidence: normalizeConfidence(0.55 + (0.25 * ((limit - index) / Math.max(limit, 1)))),
      retrievedAt: new Date()
    };
  });
}

function flattenDuckDuckGoTopics(topics: DuckDuckGoTopic[]): DuckDuckGoTopic[] {
  const flattened: DuckDuckGoTopic[] = [];
  for (const topic of topics) {
    if (Array.isArray(topic.Topics) && topic.Topics.length > 0) {
      flattened.push(...flattenDuckDuckGoTopics(topic.Topics));
    } else {
      flattened.push(topic);
    }
  }
  return flattened;
}

async function discoverFromDuckDuckGo(query: string, limit: number): Promise<ResearchSource[]> {
  const searchParams = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    no_redirect: '1',
    skip_disambig: '1'
  });
  const endpoint = `https://api.duckduckgo.com/?${searchParams.toString()}`;
  const response = await fetchJson<DuckDuckGoResponse>(endpoint);

  const sources: ResearchSource[] = [];
  const now = new Date();

  if (response.AbstractText && response.AbstractText.trim().length > 0) {
    sources.push({
      id: generateId('src'),
      title: response.Heading?.trim() || `DuckDuckGo abstract for ${query}`,
      url: response.AbstractURL,
      snippet: response.AbstractText.trim(),
      confidence: normalizeConfidence(0.7),
      retrievedAt: now
    });
  }

  const related = flattenDuckDuckGoTopics(response.RelatedTopics ?? []);
  for (const [index, topic] of related.entries()) {
    if (sources.length >= limit) {
      break;
    }

    const snippet = topic.Text?.trim();
    if (!snippet) {
      continue;
    }

    sources.push({
      id: generateId('src'),
      title: snippet.split(' - ')[0].slice(0, 120),
      url: topic.FirstURL,
      snippet,
      confidence: normalizeConfidence(0.45 + (0.2 * ((limit - index) / Math.max(limit, 1)))),
      retrievedAt: now
    });
  }

  return sources.slice(0, limit);
}

function dedupeSources(sources: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  const deduped: ResearchSource[] = [];

  for (const source of sources) {
    const key = `${source.title.toLowerCase()}|${(source.url || '').toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(source);
  }

  return deduped;
}

function fallbackSources(query: string, maxSources: number): ResearchSource[] {
  const tokens = query.split(/\s+/).filter((word) => word.length > 2);
  const count = Math.max(1, Math.min(maxSources, Math.max(3, tokens.length)));

  return Array.from({ length: count }, (_value, index) => ({
    id: generateId('src'),
    title: `Synthetic source ${index + 1}: ${query.slice(0, 48)}`,
    snippet: `Fallback synthesized context for "${tokens[index % tokens.length] || query.slice(0, 24)}".`,
    confidence: normalizeConfidence(0.35 + (0.1 * (1 - index / Math.max(count, 1)))),
    retrievedAt: new Date()
  }));
}

function resolveDiscoveryProviders(): DiscoveryProvider[] {
  return [
    { provider: 'wikipedia', discover: discoverFromWikipedia },
    { provider: 'duckduckgo', discover: discoverFromDuckDuckGo }
  ];
}

function extractClaimFromSnippet(snippet: string, query: string): string {
  const queryTerms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3);
  const sentences = snippet
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const matched = sentences.find((sentence) =>
    queryTerms.some((term) => sentence.toLowerCase().includes(term))
  );

  if (matched) {
    return matched;
  }

  return sentences[0] || snippet;
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
  const perProviderLimit = Math.max(2, Math.ceil(maxSources / 2));
  const providers = resolveDiscoveryProviders();
  const discovered: ResearchSource[] = [];

  for (const provider of providers) {
    try {
      const providerSources = await provider.discover(query, perProviderLimit);
      for (const source of providerSources) {
        discovered.push(source);
        appendRunEvent({
          runId: context.runId,
          conversationId: context.conversationId,
          type: 'research.source',
          payload: {
            sourceId: source.id,
            title: source.title,
            confidence: source.confidence,
            provider: provider.provider,
            phase: 'discover'
          }
        });
      }
    } catch (error) {
      appendRunEvent({
        runId: context.runId,
        conversationId: context.conversationId,
        type: 'research.source',
        payload: {
          provider: provider.provider,
          error: error instanceof Error ? error.message : String(error),
          phase: 'discover'
        }
      });
    }
  }

  const deduped = dedupeSources(discovered).slice(0, maxSources);
  if (deduped.length > 0) {
    return deduped;
  }

  const fallback = fallbackSources(query, maxSources);
  for (const source of fallback) {
    appendRunEvent({
      runId: context.runId,
      conversationId: context.conversationId,
      type: 'research.source',
      payload: {
        sourceId: source.id,
        title: source.title,
        confidence: source.confidence,
        provider: 'fallback',
        phase: 'discover'
      }
    });
  }

  return fallback;
}

/**
 * Phase 2: Extract — Pull key findings from discovered sources.
 */
export async function extractFindings(
  sources: ResearchSource[],
  query: string,
  context: { runId: string; conversationId: string }
): Promise<ResearchFinding[]> {
  const findings: ResearchFinding[] = sources
    .slice(0, Math.max(1, Math.min(12, sources.length)))
    .map((source) => ({
      id: generateId('finding'),
      claim: extractClaimFromSnippet(source.snippet, query),
      sources: [source.id],
      confidence: normalizeConfidence(source.confidence),
      crossChecked: false
    }));

  if (findings.length === 0) {
    const fallbackFinding: ResearchFinding = {
      id: generateId('finding'),
      claim: `No high-confidence findings extracted for "${query.slice(0, 60)}".`,
      sources: [],
      confidence: 0.2,
      crossChecked: false
    };
    findings.push(fallbackFinding);
  }

  for (const finding of findings) {
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
