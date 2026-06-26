import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HEADER_BG = '#FFFFFF';
const HEADER_BORDER = '#E2E8F0';

interface NotificationsHeaderProps {
  paddingTop: number;
  unreadCount: number;
  totalCount: number;
  onBackPress: () => void;
  onMarkAllRead?: () => void;
}

export default function NotificationsHeader({
  paddingTop,
  unreadCount,
  totalCount,
  onBackPress,
  onMarkAllRead,
}: NotificationsHeaderProps) {
  const subtitle =
    totalCount === 0
      ? 'No alerts yet'
      : unreadCount > 0
        ? `${unreadCount} unread · ${totalCount} total`
        : `${totalCount} notification${totalCount === 1 ? '' : 's'} · All caught up`;

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.iconButton}
            activeOpacity={0.75}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>

          {unreadCount > 0 && onMarkAllRead ? (
            <TouchableOpacity
              onPress={onMarkAllRead}
              style={styles.markAllButton}
              activeOpacity={0.75}
              accessibilityLabel="Mark all as read"
            >
              <Ionicons name="checkmark-done-outline" size={16} color="#2563EB" />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.iconButtonPlaceholder} />
          )}
        </View>

        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: HEADER_BORDER,
  },
  inner: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    minHeight: 118,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconButtonPlaceholder: {
    minWidth: 40,
    height: 40,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  textBlock: {
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    lineHeight: 20,
  },
});
