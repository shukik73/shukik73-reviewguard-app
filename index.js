import OpenAI from "openai";

if (process.env.OPENAI_API_KEY === "") {
  console.error(`You haven't set up your API key yet.

If you don't have an API key yet, visit:

https://platform.openai.com/signup

1. Make an account or sign in
2. Click "View API Keys" from the top right menu.
3. Click "Create new secret key"

Then, open the Secrets Tool and add OPENAI_API_KEY as a secret.`);
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GPT4Message = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Who won the world series in 2020?" },
  {
    role: "assistant",
    content: "The Los Angeles Dodgers won the World Series in 2020.",
  },
  { role: "user", content: "Where was it played?" },
];

let GPT4 = async (message) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: message,
  });

  return response.choices[0].message.content;
};

console.log(await GPT4(GPT4Message));
