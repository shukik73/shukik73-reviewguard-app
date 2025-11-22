import OpenAI from 'openai';

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey || apiKey.includes('DUMMY')) {
  console.error('❌ CRITICAL: Missing or invalid OPENAI_API_KEY');
  console.error('   Expected AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY in Secrets');
  throw new Error('Missing OPENAI_API_KEY in Secrets');
}

export const openai = new OpenAI({ apiKey });
