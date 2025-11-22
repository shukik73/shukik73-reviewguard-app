import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey.includes('DUMMY')) {
    throw new Error('Missing or invalid OPENAI_API_KEY. Please add OPENAI_API_KEY to your Secrets.');
  }
  
  return new OpenAI({ apiKey });
}

export function getOpenAI() {
  return getOpenAIClient();
}
