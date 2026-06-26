import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HEADER_BG = require('../../assets/home/connections-header-bg.png');

interface ConnectionsHeaderProps {
  paddingTop: number;
  connectionCountLabel: string;
  canGoBack: boolean;
  onBackPress?: () => void;
  onAddPress: () => void;
}

export default function ConnectionsHeader({
  paddingTop,
  connectionCountLabel,
  canGoBack,
  onBackPress,
  onAddPress,
}: ConnectionsHeaderProps) {
  return (
    <View style={styles.container}>
      <Image source={HEADER_BG} style={styles.backgroundImage} resizeMode="cover" />

      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={onBackPress}
              style={styles.iconButton}
              activeOpacity={0.75}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={20} color="#1E293B" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}

          <TouchableOpacity
            onPress={onAddPress}
            style={styles.addButton}
            activeOpacity={0.75}
            accessibilityLabel="Add connection"
          >
            <Ionicons name="person-add-outline" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.title}>Connections</Text>
          <Text style={styles.subtitle}>{connectionCountLabel}</Text>
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
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconButtonPlaceholder: {
    width: 40,
    height: 40,
  },
  addButton: {
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
