export type AppLanguage = 'en' | 'ig' | 'ha' | 'yo';

export type TranslationParams = Record<string, string | number>;

export interface LanguageOption {
  code: AppLanguage;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
];

export const LANGUAGE_STORAGE_KEY = '@famguard/language';
