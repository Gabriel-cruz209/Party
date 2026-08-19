import Groq from 'groq-sdk';

import { getOptionalEnv, getRequiredEnv } from './env';

export type GroqMessage = Groq.Chat.ChatCompletionMessageParam;

export const groqConfig = {
  apiKey: getRequiredEnv('EXPO_PUBLIC_GROQ_API_KEY'),
  baseURL: getOptionalEnv('EXPO_PUBLIC_GROQ_BASE_URL'),
  model: getRequiredEnv('EXPO_PUBLIC_GROQ_MODEL'),
};

export const groq = new Groq({
  apiKey: groqConfig.apiKey,
  baseURL: groqConfig.baseURL,
  dangerouslyAllowBrowser: true,
});

export function createSupportCompletion(messages: GroqMessage[], model = groqConfig.model) {
  return groq.chat.completions.create({
    model,
    messages,
    stream: false,
  });
}
