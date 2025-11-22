import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('FATAL: OPENAI_API_KEY is missing from Secrets.');
  }
  
  return new OpenAI({ apiKey });
}

export function getOpenAI() {
  return getOpenAIClient();
}
