import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '../context/LanguageContext';
import type { AppLanguage } from '../i18n/types';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { language, setLanguage, supportedLanguages } = useTranslation();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {supportedLanguages.map((lang) => {
        const isActive = language === lang.code;
        return (
          <TouchableOpacity
            key={lang.code}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => setLanguage(lang.code as AppLanguage)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {compact ? lang.code.toUpperCase() : lang.nativeName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  containerCompact: {
    paddingVertical: 4,
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  pillActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  pillTextActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
});
