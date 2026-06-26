import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Connection } from '../types';

interface ConnectionCardProps {
  connection: Connection;
  onViewMap: () => void;
  onMoreOptions: () => void;
}

export default function ConnectionCard({
  connection,
  onViewMap,
  onMoreOptions,
}: ConnectionCardProps) {
  const displayName = connection.connectedUserName || 'Unknown User';

  return (
    <View style={[styles.card, connection.isLocked && styles.cardEmergency]}>
      {connection.isLocked && (
        <View style={styles.emergencyBanner}>
          <Ionicons name="warning" size={14} color="#FFFFFF" />
          <Text style={styles.emergencyBannerText}>EMERGENCY</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, connection.isLocked && styles.avatarEmergency]}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, connection.isLocked && styles.nameEmergency]} numberOfLines={1}>
              {displayName}
            </Text>
            {connection.isLocked ? (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, styles.statusDotEmergency]} />
                <Text style={styles.statusTextEmergency}>Needs assistance</Text>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Connected</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onMoreOptions}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onViewMap} activeOpacity={0.85}>
          <Ionicons name="map" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText} numberOfLines={1}>
            View on Map
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onMoreOptions} activeOpacity={0.85}>
          <Ionicons name="ellipsis-horizontal" size={17} color="#6366F1" />
          <Text style={styles.secondaryButtonText} numberOfLines={1}>
            More Options
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardEmergency: {
    borderColor: '#FCA5A5',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    gap: 6,
  },
  emergencyBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmergency: {
    backgroundColor: '#FEE2E2',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6366F1',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  nameEmergency: {
    color: '#DC2626',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusDotEmergency: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#10B981',
  },
  statusTextEmergency: {
    fontSize: 13,
    fontWeight: '500',
    color: '#DC2626',
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 6,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    flexShrink: 1,
  },
});
