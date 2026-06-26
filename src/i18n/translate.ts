import type { AppLanguage, TranslationParams } from './types';
import { en } from './locales/en';
import { ig } from './locales/ig';
import { ha } from './locales/ha';
import { yo } from './locales/yo';

export type TranslationTree = { [key: string]: string | TranslationTree };

const locales: Record<AppLanguage, TranslationTree> = { en, ig, ha, yo };

function getNestedValue(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | TranslationTree | undefined = tree;

  for (const part of parts) {
    if (current === undefined || typeof current === 'string') {
      return undefined;
    }
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, paramKey: string) => {
    const value = params[paramKey];
    return value !== undefined ? String(value) : `{{${paramKey}}}`;
  });
}

export function translate(
  language: AppLanguage,
  key: string,
  params?: TranslationParams,
): string {
  const value =
    getNestedValue(locales[language], key) ??
    getNestedValue(locales.en, key) ??
    key;

  return interpolate(value, params);
}

export function isValidLanguage(code: string): code is AppLanguage {
  return code === 'en' || code === 'ig' || code === 'ha' || code === 'yo';
}
