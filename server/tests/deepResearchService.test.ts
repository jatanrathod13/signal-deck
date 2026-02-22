/**
 * DeepResearchService Tests
 * Verifies external discovery integrations are used for source retrieval.
 */

import { EventEmitter } from 'events';

jest.mock('https', () => ({
  get: jest.fn()
}));

jest.mock('../src/services/conversationService', () => ({
  appendRunEvent: jest.fn()
}));

import https from 'https';
import { discoverSources, extractFindings } from '../src/services/deepResearchService';

interface MockHttpResponse extends EventEmitter {
  statusCode?: number;
  setEncoding: jest.Mock;
  resume: jest.Mock;
}

function mockJsonResponse(payload: unknown): void {
  (https.get as jest.Mock).mockImplementationOnce(
    (_url: string, _options: unknown, callback: (response: MockHttpResponse) => void) => {
      const response = new EventEmitter() as MockHttpResponse;
      response.statusCode = 200;
      response.setEncoding = jest.fn();
      response.resume = jest.fn();

      const request = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, handler: () => void) => void;
        destroy: jest.Mock;
      };
      request.setTimeout = (_ms: number, _handler: () => void) => undefined;
      request.destroy = jest.fn();

      process.nextTick(() => {
        callback(response);
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });

      return request;
    }
  );
}

describe('DeepResearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retrieves sources from external providers and extracts findings from snippets', async () => {
    mockJsonResponse({
      query: {
        search: [
          {
            title: 'Model Context Protocol',
            snippet: 'Model Context Protocol is an open standard for tool integration.',
            pageid: 1234
          }
        ]
      }
    });

    mockJsonResponse({
      Heading: 'Model Context Protocol',
      AbstractText: 'MCP connects AI assistants to external tools and data.',
      AbstractURL: 'https://duckduckgo.com/MCP',
      RelatedTopics: []
    });

    const sources = await discoverSources(
      'What is Model Context Protocol?',
      {
        depth: 'standard',
        maxSources: 4
      },
      {
        runId: 'run-1',
        conversationId: 'conv-1'
      }
    );

    expect(https.get).toHaveBeenCalledTimes(2);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((source) => source.title.includes('Model Context Protocol'))).toBe(true);
    expect(sources.some((source) => typeof source.url === 'string' && source.url.length > 0)).toBe(true);

    const findings = await extractFindings(sources, 'Model Context Protocol', {
      runId: 'run-1',
      conversationId: 'conv-1'
    });

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].claim.length).toBeGreaterThan(0);
    expect(findings[0].sources.length).toBeGreaterThanOrEqual(1);
  });
});
