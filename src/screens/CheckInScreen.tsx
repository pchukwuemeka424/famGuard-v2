import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCheckIn } from '../context/CheckInContext';
import { useConnection } from '../context/ConnectionContext';
import CheckInHeader from '../components/CheckInHeader';
import CheckInConnectionPicker from '../components/CheckInConnectionPicker';
import type { MainTabParamList, RootStackParamList, UserCheckIn } from '../types';

const PROMO_FAMILY_IMAGE = require('../../assets/home/promo-family.png');
const PROMO_SHIELD_IMAGE = require('../../assets/home/promo-shield.png');

type CheckInScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'CheckIn'>,
  StackNavigationProp<RootStackParamList>
>;

interface CheckInScreenProps {
  navigation: CheckInScreenNavigationProp;
}

type PickerStatus = 'safe' | 'delayed';

export default function CheckInScreen({ navigation }: CheckInScreenProps) {
  const { settings, lastCheckIn, loading, checkIn, refreshCheckIns } = useCheckIn();
  const { connections } = useConnection();
  const insets = useSafeAreaInsets();

  const [checkingIn, setCheckingIn] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerStatus, setPickerStatus] = useState<PickerStatus>('safe');
  const [lastNotifiedCount, setLastNotifiedCount] = useState(0);

  const notifyableConnections = useMemo(
    () => connections.filter((connection) => connection.userId),
    [connections]
  );

  useEffect(() => {
    refreshCheckIns();
  }, []);

  const openPicker = (status: PickerStatus): void => {
    if (notifyableConnections.length === 0) {
      Alert.alert(
        'No Connections',
        'Add connections first so you can notify them when you check in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Connections', onPress: () => navigation.navigate('Connections') },
        ]
      );
      return;
    }

    setPickerStatus(status);
    setPickerVisible(true);
  };

  const handleConfirmCheckIn = async (selectedUserIds: string[]): Promise<void> => {
    if (selectedUserIds.length === 0) {
      Alert.alert('Select Connections', 'Choose at least one connection to notify.');
      return;
    }

    try {
      setCheckingIn(true);
      const success = await checkIn(pickerStatus, undefined, false, selectedUserIds);

      if (success) {
        setLastNotifiedCount(selectedUserIds.length);
        setPickerVisible(false);
        refreshCheckIns().catch((error) => {
          console.error('Error refreshing check-ins:', error);
        });

        const statusLabel = pickerStatus === 'safe' ? 'safe' : 'delayed';
        Alert.alert(
          'Check-in Sent',
          `Your ${statusLabel} status was shared with ${selectedUserIds.length} connection${selectedUserIds.length > 1 ? 's' : ''}.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to check in. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000 / 60);

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusLabel = (status: UserCheckIn['status']): string => {
    const labels: Record<UserCheckIn['status'], string> = {
      safe: 'Safe',
      unsafe: 'Unsafe',
      delayed: 'Delayed',
      missed: 'Missed',
    };
    return labels[status] || 'Unknown';
  };

  const getStatusBadgeStyle = (status?: UserCheckIn['status']) => {
    switch (status) {
      case 'safe':
        return { bg: '#D1FAE5', text: '#047857' };
      case 'delayed':
        return { bg: '#FEF3C7', text: '#B45309' };
      case 'unsafe':
      case 'missed':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      default:
        return { bg: '#DBEAFE', text: '#1D4ED8' };
    }
  };

  const badgeStyle = getStatusBadgeStyle(lastCheckIn?.status);
  const statusBadgeText = lastCheckIn ? getStatusLabel(lastCheckIn.status) : 'Not Checked In';
  const contactsNotified = lastCheckIn ? lastNotifiedCount : 0;
  const lastCheckInLabel = lastCheckIn ? formatTimeAgo(lastCheckIn.createdAt) : 'Never';
  const currentStatusLabel = lastCheckIn ? getStatusLabel(lastCheckIn.status) : 'Unknown';

  return (
    <View style={styles.container}>
      <CheckInHeader
        paddingTop={insets.top + 8}
        onSettingsPress={() => navigation.navigate('CheckInSettings')}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentCard}>
          <LinearGradient
            colors={['#ECFDF5', '#F0FDFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoBanner}
          >
            <View style={styles.bannerIconWrap}>
              <Image source={PROMO_SHIELD_IMAGE} style={styles.bannerShield} resizeMode="contain" />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Your safety matters</Text>
              <Text style={styles.bannerSubtitle}>
                Quickly update your status and keep your loved ones informed.
              </Text>
            </View>
            <Image source={PROMO_FAMILY_IMAGE} style={styles.bannerFamily} resizeMode="contain" />
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={() => openPicker('safe')}
              disabled={checkingIn || loading}
              activeOpacity={0.9}
              style={styles.quickCardTouchable}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickCard}
              >
                <View style={styles.quickIconCircle}>
                  <Ionicons name="checkmark" size={28} color="#10B981" />
                </View>
                <Text style={styles.quickTitle}>I'm Safe</Text>
                <Text style={styles.quickSubtitle}>Notify your contacts</Text>
                <View style={styles.quickArrow}>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openPicker('delayed')}
              disabled={checkingIn || loading}
              activeOpacity={0.9}
              style={styles.quickCardTouchable}
            >
              <LinearGradient
                colors={['#F59E0B', '#FBBF24']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickCard}
              >
                <View style={styles.quickIconCircle}>
                  <Ionicons name="time" size={26} color="#F59E0B" />
                </View>
                <Text style={styles.quickTitle}>Delayed</Text>
                <Text style={styles.quickSubtitle}>I'll check-in later</Text>
                <View style={styles.quickArrow}>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {checkingIn && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loadingText}>Sending your check-in...</Text>
          </View>
        )}

        {settings && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsCard}
              onPress={() => navigation.navigate('CheckInSettings')}
              activeOpacity={0.85}
            >
              <View style={styles.settingsIconWrap}>
                <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
              </View>
              <View style={styles.settingsContent}>
                <Text style={styles.settingsTitle}>Check-in Settings</Text>
                <View style={styles.settingsRow}>
                  <Ionicons name="sync-outline" size={14} color="#94A3B8" />
                  <Text style={styles.settingsDetail}>
                    Automatic check-ins: {settings.autoCheckInEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
                <View style={styles.settingsRow}>
                  <Ionicons name="time-outline" size={14} color="#94A3B8" />
                  <Text style={styles.settingsDetail}>
                    Interval: Every {settings.checkInIntervalMinutes} minutes
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusSectionTitle}>Your Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>{statusBadgeText}</Text>
            </View>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statItem}>
              <View style={[styles.statIconWrap, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="people" size={18} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Contacts Notified</Text>
              <Text style={styles.statValue}>{contactsNotified}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.statLabel}>Last Check-in</Text>
              <Text style={styles.statValue}>{lastCheckInLabel}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconWrap, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
              </View>
              <Text style={styles.statLabel}>Current Status</Text>
              <Text style={styles.statValue}>{currentStatusLabel}</Text>
            </View>
          </View>
        </View>

        {notifyableConnections.length === 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.addConnectionsCard}
              onPress={() => navigation.navigate('Connections')}
              activeOpacity={0.85}
            >
              <View style={styles.addConnectionsIcon}>
                <Ionicons name="person-add" size={22} color="#6366F1" />
              </View>
              <View style={styles.addConnectionsText}>
                <Text style={styles.addConnectionsTitle}>Add your first connection</Text>
                <Text style={styles.addConnectionsSubtitle}>
                  Connect with family or friends to start sharing check-ins.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#A5B4FC" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <CheckInConnectionPicker
        visible={pickerVisible}
        status={pickerStatus}
        connections={connections}
        submitting={checkingIn}
        onClose={() => !checkingIn && setPickerVisible(false)}
        onConfirm={handleConfirmCheckIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 0,
  },
  contentCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  infoBanner: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
  },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerShield: {
    width: 28,
    height: 28,
  },
  bannerTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    fontWeight: '500',
  },
  bannerFamily: {
    width: 90,
    height: 80,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 14,
  },
  quickCardTouchable: {
    flex: 1,
  },
  quickCard: {
    borderRadius: 20,
    padding: 16,
    minHeight: 156,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  quickTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  quickSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    lineHeight: 16,
  },
  quickArrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  settingsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContent: {
    flex: 1,
    gap: 6,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsDetail: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusSectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 14,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  addConnectionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
  },
  addConnectionsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addConnectionsText: {
    flex: 1,
  },
  addConnectionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  addConnectionsSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 24,
  },
});
