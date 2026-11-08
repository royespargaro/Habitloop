import { describe, expect, it } from 'vitest';
import { parseBrainDumpResponse } from '../services/brainDumpResponse';

const preview = { lifeAreas: [], goals: [], projects: [], habits: [], tasks: [] };

describe('parseBrainDumpResponse', () => {
  it('parses a plain JSON response', () => {
    expect(parseBrainDumpResponse(JSON.stringify(preview))).toEqual(preview);
  });

  it('strips a markdown fence and conversational prefix', () => {
    const response = `Here is the structured plan:\n\`\`\`json\n${JSON.stringify(preview)}\n\`\`\``;
    expect(parseBrainDumpResponse(response)).toEqual(preview);
  });

  it('rejects responses without a JSON object', () => {
    expect(() => parseBrainDumpResponse('No structured result was generated.')).toThrow(SyntaxError);
  });
});