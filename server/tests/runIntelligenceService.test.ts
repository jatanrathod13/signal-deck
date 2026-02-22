/**
 * RunIntelligenceService Tests
 * Verifies contiguous phase grouping and non-contiguous phase separation.
 */

jest.mock('../src/services/conversationService', () => ({
  getRun: jest.fn(),
  listRunEvents: jest.fn()
}));

import { getRun, listRunEvents } from '../src/services/conversationService';
import { buildRunIntelligence } from '../src/services/runIntelligenceService';

describe('RunIntelligenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps non-contiguous phases as separate timeline segments', () => {
    (getRun as jest.Mock).mockReturnValue({
      id: 'run-1',
      conversationId: 'conv-1',
      status: 'completed',
      startedAt: new Date('2026-02-22T10:00:00.000Z')
    });

    (listRunEvents as jest.Mock).mockReturnValue([
      {
        id: 'e1',
        runId: 'run-1',
        conversationId: 'conv-1',
        type: 'tool.call',
        payload: {},
        timestamp: new Date('2026-02-22T10:00:01.000Z')
      },
      {
        id: 'e2',
        runId: 'run-1',
        conversationId: 'conv-1',
        type: 'tool.result',
        payload: {},
        timestamp: new Date('2026-02-22T10:00:02.000Z')
      },
      {
        id: 'e3',
        runId: 'run-1',
        conversationId: 'conv-1',
        type: 'research.source',
        payload: {},
        timestamp: new Date('2026-02-22T10:00:03.000Z')
      },
      {
        id: 'e4',
        runId: 'run-1',
        conversationId: 'conv-1',
        type: 'tool.call',
        payload: {},
        timestamp: new Date('2026-02-22T10:00:04.000Z')
      }
    ]);

    const intelligence = buildRunIntelligence('run-1');

    expect(intelligence).toBeDefined();
    expect(intelligence?.phases.map((phase) => phase.name)).toEqual([
      'Tool Execution',
      'Research Discovery',
      'Tool Execution'
    ]);
    expect(intelligence?.phases[0].eventCount).toBe(2);
    expect(intelligence?.phases[1].eventCount).toBe(1);
    expect(intelligence?.phases[2].eventCount).toBe(1);
  });
});
