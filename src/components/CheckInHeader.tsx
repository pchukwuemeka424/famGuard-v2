import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HEADER_BG = require('../../assets/home/checkin-header-bg.png');

interface CheckInHeaderProps {
  paddingTop: number;
  onSettingsPress: () => void;
}

export default function CheckInHeader({
  paddingTop,
  onSettingsPress,
}: CheckInHeaderProps) {
  return (
    <View style={styles.container}>
      <Image source={HEADER_BG} style={styles.backgroundImage} resizeMode="cover" />

      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          <View style={styles.iconButtonPlaceholder} />

          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.settingsButton}
            activeOpacity={0.75}
            accessibilityLabel="Check-in settings"
          >
            <Ionicons name="settings-outline" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Safety Check-in</Text>
          <Text style={styles.subtitle}>Let your contacts know you're safe</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F4F7FB',
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
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
