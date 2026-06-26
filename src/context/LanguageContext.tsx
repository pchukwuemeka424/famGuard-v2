import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, hasValidSupabaseConfig } from '../lib/supabase';
import { translate } from '../i18n/translate';
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
  type TranslationParams,
} from '../i18n/types';
import { isValidLanguage } from '../i18n/translate';
import { useAuth } from './AuthContext';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (code: AppLanguage) => Promise<void>;
  t: (key: string, params?: TranslationParams) => string;
  loading: boolean;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [loading, setLoading] = useState(true);

  const loadLanguage = useCallback(async () => {
    try {
      setLoading(true);

      if (isAuthenticated && user?.id && hasValidSupabaseConfig) {
        const { data, error } = await supabase
          .from('user_settings')
          .select('language')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.language && isValidLanguage(data.language)) {
          setLanguageState(data.language);
          await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, data.language);
          return;
        }
      }

      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && isValidLanguage(stored)) {
        setLanguageState(stored);
      }
    } catch (error) {
      console.warn('Error loading language preference:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    loadLanguage();
  }, [loadLanguage]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !hasValidSupabaseConfig) {
      return;
    }

    const channel = supabase
      .channel(`language_pref:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newLanguage = (payload.new as { language?: string })?.language;
          if (newLanguage && isValidLanguage(newLanguage)) {
            setLanguageState(newLanguage);
            AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  const setLanguage = useCallback(
    async (code: AppLanguage) => {
      setLanguageState(code);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);

      if (isAuthenticated && user?.id && hasValidSupabaseConfig) {
        await supabase.from('user_settings').upsert(
          { user_id: user.id, language: code },
          { onConflict: 'user_id' },
        );
      }
    },
    [isAuthenticated, user?.id],
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) => translate(language, key, params),
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      loading,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t, loading],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
