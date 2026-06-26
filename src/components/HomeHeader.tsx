import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HEADER_BG = require('../../assets/home/home-header-bg.png');
const APP_LOGO = require('../../assets/fn.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const headerBgSource = Image.resolveAssetSource(HEADER_BG);
const HEADER_ASPECT =
  headerBgSource.width > 0 ? headerBgSource.height / headerBgSource.width : 0.67;
const HEADER_HEIGHT = SCREEN_WIDTH * HEADER_ASPECT;

const ACCENT_RED = '#DC2626';
const TEXT_DARK = '#0F172A';

interface HomeHeaderProps {
  paddingTop: number;
  locationSharingEnabled: boolean;
  connectionCount: number;
  unreadCount: number;
  userName?: string;
  onNotificationsPress: () => void;
}

function getGreeting(userName?: string): string {
  const hour = new Date().getHours();
  let salutation = 'Good evening';
  if (hour < 12) salutation = 'Good morning';
  else if (hour < 17) salutation = 'Good afternoon';

  const firstName = userName?.trim().split(/\s+/)[0];
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

export default function HomeHeader({
  paddingTop,
  locationSharingEnabled,
  connectionCount,
  unreadCount,
  userName,
  onNotificationsPress,
}: HomeHeaderProps) {
  const connectionLabel =
    connectionCount === 1 ? '1 connection' : `${connectionCount} connections`;
  const greeting = getGreeting(userName);

  return (
    <ImageBackground
      source={HEADER_BG}
      style={[styles.container, { height: HEADER_HEIGHT }]}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={[styles.inner, { paddingTop }]}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>FamGuard</Text>
            {locationSharingEnabled ? (
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Active</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={onNotificationsPress}
            style={styles.notificationsButton}
            activeOpacity={0.75}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={TEXT_DARK} />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusChip}>
            <Ionicons
              name={locationSharingEnabled ? 'location' : 'sunny-outline'}
              size={14}
              color={locationSharingEnabled ? ACCENT_RED : TEXT_DARK}
            />
            <Text
              style={[
                styles.statusText,
                locationSharingEnabled ? styles.statusTextActive : null,
              ]}
            >
              {locationSharingEnabled ? 'Visible to connections' : greeting}
            </Text>
          </View>

          <View style={styles.statusChip}>
            <Ionicons name="people-outline" size={14} color="#6366F1" />
            <Text style={styles.statusText}>{connectionLabel}</Text>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  backgroundImage: {
    width: SCREEN_WIDTH,
    height: HEADER_HEIGHT,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 12,
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: -0.4,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.18)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_RED,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT_RED,
    letterSpacing: 0.2,
  },
  notificationsButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: ACCENT_RED,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusRow: {
    gap: 8,
    maxWidth: '72%',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_DARK,
    lineHeight: 18,
  },
  statusTextActive: {
    color: ACCENT_RED,
  },
});
