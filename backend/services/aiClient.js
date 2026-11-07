const AI_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function analyzeContent(payload) {
  const response = await fetch(`${AI_BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'AI analysis failed.');
  }

  return response.json();
}

module.exports = { analyzeContent };
