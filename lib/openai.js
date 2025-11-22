import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY. Please add it to Secrets.');
  }
  
  return new OpenAI({ apiKey });
}

export function getOpenAI() {
  return getOpenAIClient();
}
