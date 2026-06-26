import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../context/LanguageContext';

const HEADER_BG = require('../../assets/home/profile-header-bg.png');

interface UserManualHeaderProps {
  paddingTop: number;
  currentSection: number;
  totalSections: number;
  progress: number;
  onBackPress: () => void;
  onSkipPress: () => void;
}

export default function UserManualHeader({
  paddingTop,
  currentSection,
  totalSections,
  progress,
  onBackPress,
  onSkipPress,
}: UserManualHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Image source={HEADER_BG} style={styles.backgroundImage} resizeMode="cover" />

      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.75}
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSkipPress}
            style={styles.skipButton}
            activeOpacity={0.75}
            accessibilityLabel={t('common.skip')}
          >
            <Text style={styles.skipButtonText}>{t('common.skip')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <View style={styles.bookIcon}>
              <Ionicons name="book-outline" size={22} color="#DC2626" />
            </View>
            <Text style={styles.title}>{t('userManual.title')}</Text>
          </View>
          <Text style={styles.subtitle}>
            {t('userManual.progress', { current: currentSection, total: totalSections })}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F3FF',
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  inner: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    minHeight: 132,
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  textBlock: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bookIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(254, 226, 226, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.9)',
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 6,
    marginLeft: 50,
    lineHeight: 20,
  },
  progressContainer: {
    marginTop: 2,
  },
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 3,
  },
});
