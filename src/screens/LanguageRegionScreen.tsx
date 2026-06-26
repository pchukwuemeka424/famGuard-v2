import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import type { AppLanguage } from '../i18n/types';

type LanguageRegionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LanguageRegion'>;

interface LanguageRegionScreenProps {
  navigation: LanguageRegionScreenNavigationProp;
}

const regions = [
  { code: 'NG', nameKey: 'languageRegion.nigeria' },
];

export default function LanguageRegionScreen({ navigation }: LanguageRegionScreenProps) {
  const { user } = useAuth();
  const { t, language, setLanguage, supportedLanguages } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(language);
  const [selectedRegion, setSelectedRegion] = useState('NG');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
      setupRealtimeSubscription();
    } else {
      setLoading(false);
    }

    return () => {
      if (realtimeChannelRef.current) {
        try {
          supabase.removeChannel(realtimeChannelRef.current);
        } catch (error) {
          console.warn('Error removing channel during cleanup:', error);
        }
        realtimeChannelRef.current = null;
      }
    };
  }, [user?.id]);

  const setupRealtimeSubscription = (): void => {
    if (!user?.id) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channelName = `language_region:${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as { language?: string; region?: string };
          if (newData?.language) {
            setSelectedLanguage(newData.language as AppLanguage);
          }
          if (newData?.region) {
            setSelectedRegion(newData.region);
          }
        },
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  };

  const loadSettings = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('user_settings')
        .select('language, region')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          await createDefaultSettings();
        } else {
          console.error('Error loading language/region settings:', error);
        }
      } else if (data) {
        if (data.language) setSelectedLanguage(data.language as AppLanguage);
        if (data.region) setSelectedRegion(data.region);
      }
    } catch (error) {
      console.error('Error loading language/region settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async (): Promise<void> => {
    if (!user?.id) return;

    try {
      await supabase.from('user_settings').insert({
        user_id: user.id,
        language: 'en',
        region: 'NG',
      });
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  const handleSelectLanguage = async (code: AppLanguage) => {
    if (saving) return;

    try {
      setSaving(true);
      setSelectedLanguage(code);
      await setLanguage(code);

      if (user?.id) {
        const { error } = await supabase.from('user_settings').upsert(
          {
            user_id: user.id,
            language: code,
          },
          { onConflict: 'user_id' },
        );

        if (error) {
          console.error('Error saving language:', error);
          Alert.alert(t('common.error'), t('languageRegion.alertSaveLanguageFailed'));
          await loadSettings();
        }
      }
    } catch (error) {
      console.error('Error saving language:', error);
      Alert.alert(t('common.error'), t('languageRegion.alertSaveLanguageFailed'));
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectRegion = async (code: string) => {
    if (!user?.id || saving) return;

    try {
      setSaving(true);
      setSelectedRegion(code);

      const { error } = await supabase.from('user_settings').upsert(
        {
          user_id: user.id,
          region: code,
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Error saving region:', error);
        Alert.alert(t('common.error'), t('languageRegion.alertSaveRegionFailed'));
        await loadSettings();
      }
    } catch (error) {
      console.error('Error saving region:', error);
      Alert.alert(t('common.error'), t('languageRegion.alertSaveRegionFailed'));
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  const getLanguageLabel = (code: AppLanguage): string => {
    const option = supportedLanguages.find((lang) => lang.code === code);
    return option ? `${option.name} (${option.nativeName})` : code;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('languageRegion.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>{t('common.loadingSettings')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('languageRegion.language')}</Text>
              {supportedLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.option, selectedLanguage === lang.code && styles.optionSelected]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  disabled={saving}
                >
                  <Text style={styles.optionText}>{getLanguageLabel(lang.code)}</Text>
                  {selectedLanguage === lang.code && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('languageRegion.region')}</Text>
              {regions.map((region) => (
                <TouchableOpacity
                  key={region.code}
                  style={[styles.option, selectedRegion === region.code && styles.optionSelected]}
                  onPress={() => handleSelectRegion(region.code)}
                >
                  <Text style={styles.optionText}>{t(region.nameKey)}</Text>
                  {selectedRegion === region.code && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionText: {
    fontSize: 16,
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
