import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HEADER_BG = require('../../assets/home/safety-feed-header-bg.png');

interface SafetyFeedHeaderProps {
  paddingTop: number;
  incidentCount: number;
  radiusKm: number;
  onReportPress?: () => void;
  hideReport?: boolean;
}

export default function SafetyFeedHeader({
  paddingTop,
  incidentCount,
  radiusKm,
  onReportPress,
  hideReport = false,
}: SafetyFeedHeaderProps) {
  const subtitle =
    incidentCount === 0
      ? 'No active reports nearby'
      : `${incidentCount} report${incidentCount === 1 ? '' : 's'} within ${radiusKm} km`;

  return (
    <View style={styles.container}>
      <Image source={HEADER_BG} style={styles.backgroundImage} resizeMode="cover" />

      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          <View style={styles.iconButtonPlaceholder} />

          {!hideReport && onReportPress ? (
            <TouchableOpacity
              onPress={onReportPress}
              style={styles.reportButton}
              activeOpacity={0.75}
              accessibilityLabel="Report incident"
            >
              <Ionicons name="add" size={22} color="#2563EB" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Safety Feed</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8F4FD',
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
    minHeight: 120,
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textBlock: {
    paddingRight: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 20,
  },
});
