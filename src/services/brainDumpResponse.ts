export function parseBrainDumpResponse(rawResponse: string): unknown {
  const cleaned = rawResponse
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start < 0 || end < start) throw new SyntaxError('Gemini response did not contain a JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1));
}