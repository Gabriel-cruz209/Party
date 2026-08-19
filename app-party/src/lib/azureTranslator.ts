import TextTranslationClient, {
  isUnexpected,
  type TranslatorCredential,
} from '@azure-rest/ai-translation-text';

import { getOptionalEnv, getRequiredEnv } from './env';

export type TranslateTextInput = {
  text: string;
  from?: string | null;
  to?: string[];
};

export const azureTranslatorConfig = {
  endpoint: getRequiredEnv('EXPO_PUBLIC_AZURE_TRANSLATOR_ENDPOINT'),
  key: getRequiredEnv('EXPO_PUBLIC_AZURE_TRANSLATOR_KEY'),
  region: getRequiredEnv('EXPO_PUBLIC_AZURE_TRANSLATOR_REGION'),
  defaultFrom: getOptionalEnv('EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_FROM') ?? 'pt',
  defaultTo: getOptionalEnv('EXPO_PUBLIC_AZURE_TRANSLATOR_DEFAULT_TO') ?? 'en',
};

const azureTranslatorCredential: TranslatorCredential = {
  key: azureTranslatorConfig.key,
  region: azureTranslatorConfig.region,
};

export const azureTranslator = TextTranslationClient(
  azureTranslatorConfig.endpoint,
  azureTranslatorCredential,
);

export function normalizeTranslationLanguage(language: string): string {
  return language.trim().split('-')[0]?.toLowerCase() || 'pt';
}

export async function translateText({
  text,
  from = null,
  to = [azureTranslatorConfig.defaultTo],
}: TranslateTextInput) {
  const input: {
    language?: string;
    targets: { language: string }[];
    text: string;
  } = {
    text,
    targets: to.map((language) => ({ language: normalizeTranslationLanguage(language) })),
  };

  if (from) {
    input.language = normalizeTranslationLanguage(from);
  }

  const translateResponse = await azureTranslator.path('/translate').post({
    body: {
      inputs: [input],
    },
  });

  if (isUnexpected(translateResponse)) {
    const error = translateResponse.body.error as { code?: string; message?: string } | undefined;

    throw new Error(error?.message ?? error?.code ?? 'Azure Translator request failed.');
  }

  return translateResponse.body.value;
}

export async function getSupportedTranslationLanguages(scope = 'translation') {
  const languagesResponse = await azureTranslator.path('/languages').get({
    queryParameters: {
      scope,
    },
  });

  if (isUnexpected(languagesResponse)) {
    const error = languagesResponse.body.error as { code?: string; message?: string } | undefined;

    throw new Error(error?.message ?? error?.code ?? 'Azure Translator languages request failed.');
  }

  return languagesResponse.body;
}
