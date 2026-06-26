import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import NotificationsHeader from '../components/NotificationsHeader';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types';

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notifications'>;

interface NotificationsScreenProps {
  navigation: NotificationsScreenNavigationProp;
}

interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: any;
  read: boolean;
  created_at: string;
  updated_at: string;
}

type FilterTab = 'all' | 'unread' | 'alerts';

interface NotificationSection {
  title: string;
  data: Notification[];
}

const SCREEN_BG = '#F1F5F9';

const SOLID_TINTS: Record<string, { pill: string; icon: string; cta: string; chip: string }> = {
  '#DC2626': { pill: '#FEE2E2', icon: '#FECACA', cta: '#FEF2F2', chip: '#FEE2E2' },
  '#EF4444': { pill: '#FEE2E2', icon: '#FECACA', cta: '#FEF2F2', chip: '#FEE2E2' },
  '#EA580C': { pill: '#FFEDD5', icon: '#FED7AA', cta: '#FFF7ED', chip: '#FFEDD5' },
  '#D97706': { pill: '#FEF3C7', icon: '#FDE68A', cta: '#FFFBEB', chip: '#FEF3C7' },
  '#F59E0B': { pill: '#FEF3C7', icon: '#FDE68A', cta: '#FFFBEB', chip: '#FEF3C7' },
  '#3B82F6': { pill: '#DBEAFE', icon: '#BFDBFE', cta: '#EFF6FF', chip: '#DBEAFE' },
  '#2563EB': { pill: '#DBEAFE', icon: '#BFDBFE', cta: '#EFF6FF', chip: '#DBEAFE' },
  '#10B981': { pill: '#D1FAE5', icon: '#A7F3D0', cta: '#ECFDF5', chip: '#D1FAE5' },
  '#059669': { pill: '#D1FAE5', icon: '#A7F3D0', cta: '#ECFDF5', chip: '#D1FAE5' },
  '#6366F1': { pill: '#E0E7FF', icon: '#C7D2FE', cta: '#EEF2FF', chip: '#E0E7FF' },
};

const getSolidTints = (color: string) =>
  SOLID_TINTS[color] ?? { pill: '#F1F5F9', icon: '#E2E8F0', cta: '#F8FAFC', chip: '#F1F5F9' };

const FILTER_TAB_KEYS: { key: FilterTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'notifications.filterAll' },
  { key: 'unread', labelKey: 'notifications.filterUnread' },
  { key: 'alerts', labelKey: 'notifications.filterAlerts' },
];

const ALERT_TYPES = new Set([
  'sos_alert',
  'check_in_emergency',
  'missed_check_in',
  'check_in_unsafe',
  'incident',
  'incident_proximity',
]);

interface AlertPresentation {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  headline: string;
  title: string;
  body: string;
  actionLabel: string | null;
  isCritical: boolean;
}

const stripEmojis = (text: string): string =>
  text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

const extractPersonName = (item: Notification): string => {
  if (item.data?.userName && typeof item.data.userName === 'string') {
    return item.data.userName.trim();
  }

  const fromTitle = stripEmojis(item.title)
    .replace(/emergency\s*alert/gi, '')
    .replace(/[-–—|:]/g, '')
    .trim();
  if (fromTitle) return fromTitle;

  const bodyMatch = item.body.match(/^(.+?)\s+needs\s+help/i);
  if (bodyMatch?.[1]) return stripEmojis(bodyMatch[1]);

  const checkedInMatch = item.body.match(/^(.+?)\s+(checked\s+in|missed|marked|feels)/i);
  if (checkedInMatch?.[1]) return stripEmojis(checkedInMatch[1]);

  return 'Your connection';
};

const getActionLabelForType = (item: Notification): string | null => {
  if (
    (item.type === 'sos_alert' ||
      item.type === 'check_in_emergency' ||
      item.type === 'missed_check_in' ||
      item.type === 'check_in_unsafe' ||
      item.type === 'incident') &&
    item.data?.location
  ) {
    return 'View on map';
  }
  if (item.type === 'connection_added') return 'View connections';
  if (item.type === 'incident_proximity') return 'View incidents';
  if (item.type === 'location_reminder') return 'Update location';
  return null;
};

const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'sos_alert':
      return 'pulse';
    case 'connection_added':
      return 'person-add-outline';
    case 'location_updated':
      return 'navigate-outline';
    case 'location_reminder':
      return 'location-outline';
    case 'incident':
      return 'warning-outline';
    case 'incident_proximity':
      return 'navigate-circle-outline';
    case 'check_in':
      return 'checkmark-circle-outline';
    case 'check_in_emergency':
      return 'medkit-outline';
    case 'check_in_unsafe':
      return 'shield-half-outline';
    case 'missed_check_in':
      return 'hourglass-outline';
    case 'travel_advisory':
      return 'airplane-outline';
    case 'route_risk':
      return 'map-outline';
    default:
      return 'notifications-outline';
  }
};

const getNotificationColor = (type: string, data?: any): string => {
  if (type === 'incident_proximity' && data?.alertLevel) {
    switch (data.alertLevel) {
      case 'danger':
        return '#DC2626';
      case 'warning':
        return '#F59E0B';
      case 'alert':
        return '#EF4444';
      default:
        return '#EF4444';
    }
  }

  switch (type) {
    case 'sos_alert':
    case 'check_in_emergency':
      return '#DC2626';
    case 'check_in_unsafe':
    case 'missed_check_in':
      return '#F59E0B';
    case 'connection_added':
      return '#10B981';
    case 'location_reminder':
      return '#3B82F6';
    case 'incident':
    case 'incident_proximity':
      return '#EF4444';
    case 'check_in':
      return '#059669';
    case 'travel_advisory':
    case 'route_risk':
      return '#6366F1';
    default:
      return '#3B82F6';
  }
};

const getCategoryLabel = (type: string): string => {
  switch (type) {
    case 'sos_alert':
      return 'Emergency';
    case 'check_in_emergency':
    case 'check_in_unsafe':
    case 'missed_check_in':
      return 'Check-in';
    case 'check_in':
      return 'Safe';
    case 'connection_added':
      return 'Connection';
    case 'location_updated':
    case 'location_reminder':
      return 'Location';
    case 'incident':
    case 'incident_proximity':
      return 'Incident';
    case 'travel_advisory':
      return 'Advisory';
    case 'route_risk':
      return 'Route';
    default:
      return 'Update';
  }
};

const getAlertPresentation = (item: Notification): AlertPresentation => {
  const name = extractPersonName(item);
  const hasLocation = Boolean(item.data?.location?.latitude && item.data?.location?.longitude);
  const locationHint = hasLocation ? ' Tap to open their location on the map.' : '';

  switch (item.type) {
    case 'sos_alert':
      return {
        icon: 'pulse',
        color: '#DC2626',
        headline: 'SOS Emergency',
        title: `${name} needs help now`,
        body: `An SOS alert was sent. Their location is being shared so you can respond quickly.${locationHint}`,
        actionLabel: hasLocation ? 'Open live location' : null,
        isCritical: true,
      };
    case 'check_in_emergency':
      return {
        icon: 'medkit',
        color: '#DC2626',
        headline: 'Emergency Check-in',
        title: `${name} reported an emergency`,
        body: `They marked their check-in as an emergency. Please reach out immediately.${locationHint}`,
        actionLabel: hasLocation ? 'View their location' : 'Check on them',
        isCritical: true,
      };
    case 'check_in_unsafe':
      return {
        icon: 'shield-half-outline',
        color: '#EA580C',
        headline: 'Safety Alert',
        title: `${name} feels unsafe`,
        body: `They checked in as unsafe and may need support.${locationHint}`,
        actionLabel: hasLocation ? 'View their location' : null,
        isCritical: false,
      };
    case 'missed_check_in':
      return {
        icon: 'hourglass-outline',
        color: '#D97706',
        headline: 'Missed Check-in',
        title: `${name} missed a check-in`,
        body: `A scheduled check-in was not completed. Confirm they are safe.${locationHint}`,
        actionLabel: hasLocation ? 'View last location' : null,
        isCritical: false,
      };
    case 'incident':
      return {
        icon: 'warning-outline',
        color: '#EF4444',
        headline: 'Incident Report',
        title: stripEmojis(item.title) || 'Nearby incident reported',
        body: item.body || 'A safety incident was reported in your area.',
        actionLabel: hasLocation ? 'View on map' : null,
        isCritical: false,
      };
    case 'incident_proximity': {
      const alertLevel = item.data?.alertLevel;
      const levelLabel =
        alertLevel === 'danger' ? 'Very close' : alertLevel === 'warning' ? 'Nearby' : 'In your area';
      return {
        icon: 'navigate-circle-outline',
        color: getNotificationColor(item.type, item.data),
        headline: 'Proximity Alert',
        title: stripEmojis(item.title) || 'Incident near you',
        body: item.body || `A reported incident is ${levelLabel.toLowerCase()}. Stay alert and review details.`,
        actionLabel: 'View incidents',
        isCritical: alertLevel === 'danger',
      };
    }
    default:
      return {
        icon: getNotificationIcon(item.type),
        color: getNotificationColor(item.type, item.data),
        headline: getCategoryLabel(item.type),
        title: stripEmojis(item.title) || 'Notification',
        body: item.body,
        actionLabel: getActionLabelForType(item),
        isCritical: false,
      };
  }
};

type DateGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

const getDateGroupKey = (dateString: string): DateGroupKey => {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= startOfWeek) return 'thisWeek';
  return 'earlier';
};

const DATE_GROUP_ORDER: DateGroupKey[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

const getDateGroupLabel = (key: DateGroupKey, t: (labelKey: string) => string): string => {
  switch (key) {
    case 'today':
      return t('common.today');
    case 'yesterday':
      return t('common.yesterday');
    case 'thisWeek':
      return 'This Week';
    case 'earlier':
      return 'Earlier';
  }
};

const groupNotificationsByDate = (
  items: Notification[],
  t: (labelKey: string) => string,
): NotificationSection[] => {
  const groups = new Map<DateGroupKey, Notification[]>();

  for (const item of items) {
    const group = getDateGroupKey(item.created_at);
    const existing = groups.get(group) || [];
    existing.push(item);
    groups.set(group, existing);
  }

  return DATE_GROUP_ORDER
    .filter((key) => groups.has(key))
    .map((key) => ({ title: getDateGroupLabel(key, t), data: groups.get(key)! }));
};

const formatDate = (dateString: string, t: (labelKey: string) => string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('common.justNow');
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const notificationChannelRef = React.useRef<any>(null);
  const locationHistoryChannelRef = React.useRef<any>(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      setNotifications(data || []);
      const unread = (data || []).filter((n: Notification) => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const saveUserLocation = async () => {
      if (!user?.id) return;

      try {
        const { locationService } = await import('../services/locationService');

        const hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          if (__DEV__) {
            console.log('Location permission not granted - skipping location save on notification screen open');
          }
          return;
        }

        const currentLocation = await locationService.getHighAccuracyLocation(true);
        if (!currentLocation) {
          if (__DEV__) {
            console.log('Could not get location - skipping location save on notification screen open');
          }
          return;
        }

        let locationAccuracy: number | null = null;
        try {
          const { Location: ExpoLocation } = await import('expo-location');

          const locationWithAccuracy = await ExpoLocation.getCurrentPositionAsync({
            accuracy: Platform.OS === 'ios' ? ExpoLocation.Accuracy.BestForNavigation : ExpoLocation.Accuracy.Highest,
            maximumAge: 0,
            timeout: 10000,
          });
          locationAccuracy =
            locationWithAccuracy?.coords?.accuracy !== undefined && locationWithAccuracy?.coords?.accuracy !== null
              ? locationWithAccuracy.coords.accuracy
              : null;
        } catch (accuracyError) {
          if (__DEV__) {
            console.warn('Could not get location accuracy:', accuracyError);
          }
        }

        await locationService.saveLocationToHistory(user.id, currentLocation, false, locationAccuracy);

        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('location_sharing_enabled')
          .eq('user_id', user.id)
          .single();

        const shareLocation = userSettings?.location_sharing_enabled ?? false;

        if (shareLocation) {
          await supabase
            .from('connections')
            .update({
              location_latitude: currentLocation.latitude,
              location_longitude: currentLocation.longitude,
              location_address: currentLocation.address || null,
              location_updated_at: new Date().toISOString(),
            })
            .eq('connected_user_id', user.id)
            .eq('status', 'connected');

          if (__DEV__) {
            console.log('✅ Location updated in connections table for real-time sharing');
          }
        }

        if (__DEV__) {
          console.log('✅ Location saved to history when opening notification screen');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('Error saving location when opening notification screen:', error);
        }
      }
    };

    saveUserLocation();
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();

    if (user?.id) {
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      notificationChannelRef.current = channel;

      const locationChannel = supabase
        .channel(`notification_screen_location:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'location_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (__DEV__) {
              console.log('Location history updated via real-time subscription in notification screen:', payload.new?.id);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'connections',
            filter: `connected_user_id=eq.${user.id}`,
          },
          () => {
            if (__DEV__) {
              console.log('Connection location updated via real-time subscription in notification screen');
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && __DEV__) {
            console.log('✅ Subscribed to location real-time updates in notification screen');
          }
        });

      locationHistoryChannelRef.current = locationChannel;
    }

    return () => {
      if (notificationChannelRef.current) {
        supabase.removeChannel(notificationChannelRef.current);
      }
      if (locationHistoryChannelRef.current) {
        supabase.removeChannel(locationHistoryChannelRef.current);
      }
    };
  }, [user?.id, loadNotifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    if (activeFilter === 'alerts') {
      return notifications.filter((n) => ALERT_TYPES.has(n.type));
    }
    return notifications;
  }, [notifications, activeFilter]);

  const sections = useMemo(
    () => groupNotificationsByDate(filteredNotifications, t),
    [filteredNotifications, t]
  );

  const markAsRead = async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);
      const notificationData = notification?.data as any;
      const requiresLocationUpdate = notificationData?.requiresLocationUpdate === true;
      const notificationType = notificationData?.type;

      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (requiresLocationUpdate && notificationType === 'quick_message') {
        try {
          const { locationService } = await import('../services/locationService');

          const hasPermission = await locationService.checkPermissions();
          if (!hasPermission) {
            const permissionResult = await locationService.requestPermissions();
            if (!permissionResult.granted) {
              console.warn('Location permission denied when updating from quick message notification');
              Alert.alert(
                'Location Permission Required',
                'To update your location, please grant location permission in Settings.',
                [{ text: 'OK' }]
              );
              return;
            }
          }

          const currentLocation = await locationService.getHighAccuracyLocation(true);
          if (currentLocation) {
            if (user?.id) {
              await locationService.saveLocationToHistory(user.id, currentLocation);

              const { data: userSettings } = await supabase
                .from('user_settings')
                .select('location_sharing_enabled')
                .eq('user_id', user.id)
                .single();

              if (userSettings?.location_sharing_enabled) {
                await supabase
                  .from('connections')
                  .update({
                    location_latitude: currentLocation.latitude,
                    location_longitude: currentLocation.longitude,
                    location_address: currentLocation.address || null,
                    location_updated_at: new Date().toISOString(),
                  })
                  .eq('connected_user_id', user.id)
                  .eq('status', 'connected');
              }

              console.log('✅ Location updated after reading quick message notification');
            }
          }
        } catch (locationError) {
          console.error('Error updating location from quick message notification:', locationError);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        Alert.alert(t('common.error'), t('notifications.alertMarkAllReadFailed'));
        return;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert(t('common.error'), t('notifications.alertMarkAllReadFailed'));
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      const deletedNotification = notifications.find((n) => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (item: Notification) => {
    const isEmergencyAlert =
      item.type === 'sos_alert' ||
      item.type === 'check_in_emergency' ||
      item.type === 'missed_check_in' ||
      item.type === 'check_in_unsafe' ||
      item.type === 'incident';
    const isConnectionRequest = item.type === 'connection_added';
    const isIncidentProximity = item.type === 'incident_proximity';
    const isLocationReminder = item.type === 'location_reminder';

    if (!item.read) {
      markAsRead(item.id);
    }

    if (isLocationReminder) {
      try {
        const { locationService } = await import('../services/locationService');

        const hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          const permissionResult = await locationService.requestPermissions();
          if (!permissionResult.granted) {
            Alert.alert('Permission Required', 'Location permission is required to update your location.', [
              { text: 'OK' },
            ]);
            return;
          }
        }

        const currentLocation = await locationService.getHighAccuracyLocation(true);
        if (currentLocation && user?.id) {
          await locationService.saveLocationToHistory(user.id, currentLocation, true);

          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('location_sharing_enabled')
            .eq('user_id', user.id)
            .single();

          const shareLocation = userSettings?.location_sharing_enabled ?? false;

          if (shareLocation) {
            const { data: familyMember } = await supabase
              .from('family_members')
              .select('family_group_id')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();

            if (familyMember?.family_group_id) {
              await supabase
                .from('family_members')
                .update({
                  location_latitude: currentLocation.latitude,
                  location_longitude: currentLocation.longitude,
                  location_address: currentLocation.address || null,
                  last_seen: new Date().toISOString(),
                })
                .eq('user_id', user.id)
                .eq('family_group_id', familyMember.family_group_id);
            }
          }

          Alert.alert('Location Updated', 'Your location has been updated successfully.', [{ text: 'OK' }]);
        } else {
          Alert.alert('Location Error', 'Unable to get your current location. Please check your location settings.', [
            { text: 'OK' },
          ]);
        }
      } catch (error) {
        console.error('Error updating location from notification:', error);
        Alert.alert('Error', 'Failed to update location. Please try again.', [{ text: 'OK' }]);
      }
      return;
    }

    if (isEmergencyAlert && item.data?.location) {
      const location = item.data.location;
      const userId = item.data.userId;
      const userName = extractPersonName(item);

      if (location.latitude && location.longitude) {
        navigation.navigate('MapView', {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
          },
          title: userName,
          showUserLocation: true,
          userId: userId,
        });
      }
    }

    if (isConnectionRequest) {
      navigation.navigate('Connections');
    }

    if (isIncidentProximity) {
      navigation.navigate('Incidents');
    }
  };

  const getActionLabel = (item: Notification): string | null => {
    if (ALERT_TYPES.has(item.type)) {
      return getAlertPresentation(item).actionLabel;
    }
    return getActionLabelForType(item);
  };

  const renderEmergencyAlert = (item: Notification, presentation: AlertPresentation) => {
    const alertLevel = item.data?.alertLevel || null;
    const isDanger = alertLevel === 'danger';
    const isWarning = alertLevel === 'warning';
    const tints = getSolidTints(presentation.color);

    return (
      <TouchableOpacity
        style={[
          styles.emergencyRow,
          presentation.isCritical && styles.emergencyRowCritical,
          !item.read && styles.emergencyRowUnread,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.78}
      >
        <View style={styles.emergencyRowInner}>
          <View style={styles.emergencyTopBar}>
            <View style={[styles.emergencyHeadlinePill, { backgroundColor: tints.pill }]}>
              <Ionicons name={presentation.icon} size={12} color={presentation.color} />
              <Text style={[styles.emergencyHeadlineText, { color: presentation.color }]}>
                {presentation.headline.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.emergencyTime}>{formatDate(item.created_at, t)}</Text>
          </View>

          <View style={styles.emergencyMain}>
            <View
              style={[
                styles.emergencyIconWrap,
                { backgroundColor: presentation.color },
                presentation.isCritical && styles.emergencyIconWrapCritical,
              ]}
            >
              <Ionicons name={presentation.icon} size={24} color="#FFFFFF" />
            </View>

            <View style={styles.emergencyContent}>
              <Text
                style={[
                  styles.emergencyTitle,
                  !item.read && styles.emergencyTitleUnread,
                  isDanger && styles.notificationTitleDanger,
                  isWarning && styles.notificationTitleWarning,
                ]}
              >
                {presentation.title}
              </Text>
              <Text style={styles.emergencyBody}>{presentation.body}</Text>
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteNotification(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Delete notification"
            >
              <Ionicons name="close" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {item.data?.location ? (
            <View style={styles.emergencyLocationCard}>
              <View style={styles.emergencyLocationHeader}>
                <Ionicons name="location" size={15} color={presentation.color} />
                <Text style={[styles.emergencyLocationLabel, { color: presentation.color }]}>
                  Last known location
                </Text>
              </View>
              {item.data.location.address ? (
                <Text style={styles.emergencyLocationAddress} numberOfLines={2}>
                  {item.data.location.address}
                </Text>
              ) : null}
              {item.data.location.latitude && item.data.location.longitude ? (
                <Text style={styles.emergencyLocationCoords}>
                  {item.data.location.latitude.toFixed(6)}, {item.data.location.longitude.toFixed(6)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {item.type === 'incident_proximity' && alertLevel ? (
            <View
              style={[
                styles.alertBadge,
                isDanger && styles.alertBadgeDanger,
                isWarning && styles.alertBadgeWarning,
                alertLevel === 'alert' && styles.alertBadgeAlert,
              ]}
            >
              <Ionicons name="warning-outline" size={11} color="#DC2626" />
              <Text style={styles.alertBadgeText}>{alertLevel.toUpperCase()} RISK</Text>
            </View>
          ) : null}

          {presentation.actionLabel ? (
            <View style={[styles.emergencyCta, { backgroundColor: tints.cta }]}>
              <Ionicons
                name={presentation.actionLabel.includes('incident') ? 'list-outline' : 'map-outline'}
                size={16}
                color={presentation.color}
              />
              <Text style={[styles.emergencyCtaText, { color: presentation.color }]}>
                {presentation.actionLabel}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={presentation.color} />
            </View>
          ) : null}

          {!item.read ? <View style={[styles.emergencyUnreadBar, { backgroundColor: presentation.color }]} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderNotification = (item: Notification) => {
    if (ALERT_TYPES.has(item.type)) {
      return renderEmergencyAlert(item, getAlertPresentation(item));
    }

    const iconName = getNotificationIcon(item.type);
    const iconColor = getNotificationColor(item.type, item.data);
    const categoryLabel = getCategoryLabel(item.type);
    const isGreeting =
      item.data?.type === 'morning_greeting' ||
      item.data?.type === 'afternoon_greeting' ||
      (item.type === 'general' &&
        (item.data?.type === 'morning_greeting' || item.data?.type === 'afternoon_greeting'));

    const actionLabel = getActionLabel(item);
    const tints = getSolidTints(iconColor);

    return (
      <TouchableOpacity
        style={[styles.listRow, !item.read && styles.listRowUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.72}
      >
        <View style={styles.listRowInner}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconContainer, { backgroundColor: tints.icon }]}>
              <Ionicons name={iconName} size={20} color={iconColor} />
            </View>
            {!item.read ? <View style={styles.unreadRing} /> : null}
          </View>

          <View style={styles.listRowContent}>
            <View style={styles.listRowHeader}>
              <View style={styles.listRowHeaderLeft}>
                <Text
                  style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread]}
                  numberOfLines={2}
                >
                  {stripEmojis(item.title)}
                </Text>
                <View style={styles.listMetaRow}>
                  <Text style={[styles.categoryText, { color: iconColor }]}>{categoryLabel}</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.timeText}>{formatDate(item.created_at, t)}</Text>
                </View>
              </View>

              <View style={styles.listRowActions}>
                {actionLabel ? (
                  <View style={[styles.actionChip, { backgroundColor: tints.chip }]}>
                    <Ionicons name="chevron-forward" size={14} color={iconColor} />
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteNotification(item.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Delete notification"
                >
                  <Ionicons name="close" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            </View>

            <Text
              style={[styles.notificationBody, isGreeting && styles.notificationBodyGreeting]}
              numberOfLines={isGreeting ? undefined : 2}
            >
              {item.body}
            </Text>

            {actionLabel ? (
              <View style={styles.listRowFooter}>
                <Text style={[styles.actionText, { color: iconColor }]}>{actionLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = ({ item: section }: { item: NotificationSection }) => (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      {section.data.map((notification) => (
        <View key={notification.id} style={styles.messageCardWrap}>
          {renderNotification(notification)}
        </View>
      ))}
    </View>
  );

  const renderEmpty = () => {
    const emptyCopy =
      activeFilter === 'unread'
        ? { title: t('notifications.emptyAllCaughtUpTitle'), text: t('notifications.emptyAllCaughtUpText') }
        : activeFilter === 'alerts'
          ? { title: t('notifications.emptyNoAlertsTitle'), text: t('notifications.emptyNoAlertsText') }
          : { title: t('notifications.emptyNoNotificationsTitle'), text: t('notifications.emptyNoNotificationsText') };

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Ionicons
            name={activeFilter === 'alerts' ? 'shield-checkmark-outline' : 'notifications-off-outline'}
            size={36}
            color="#94A3B8"
          />
        </View>
        <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
        <Text style={styles.emptyText}>{emptyCopy.text}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <NotificationsHeader
        paddingTop={12}
        unreadCount={unreadCount}
        totalCount={notifications.length}
        onBackPress={() => navigation.goBack()}
        onMarkAllRead={unreadCount > 0 ? markAllAsRead : undefined}
      />

      <View style={styles.filterPanel}>
        <View style={styles.filterRow}>
          {FILTER_TAB_KEYS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count =
              tab.key === 'unread'
                ? unreadCount
                : tab.key === 'alerts'
                  ? notifications.filter((n) => ALERT_TYPES.has(n.type)).length
                  : notifications.length;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterSegment, isActive && styles.filterSegmentActive]}
                onPress={() => setActiveFilter(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterSegmentText, isActive && styles.filterSegmentTextActive]}>
                  {t(tab.labelKey)}
                </Text>
                {count > 0 ? (
                  <Text style={[styles.filterSegmentCount, isActive && styles.filterSegmentCountActive]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>{t('common.loadingNotifications')}</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={sections}
          renderItem={renderSection}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" colors={['#2563EB']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  filterPanel: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  filterRow: {
    flexDirection: 'row',
    gap: 4,
  },
  filterSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  filterSegmentActive: {
    backgroundColor: '#2563EB',
  },
  filterSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterSegmentTextActive: {
    color: '#FFFFFF',
  },
  filterSegmentCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    minWidth: 18,
    textAlign: 'center',
  },
  filterSegmentCountActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  sectionBlock: {
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  messageCardWrap: {
    marginBottom: 12,
  },
  listRow: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EEF6',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  listRowUnread: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  emergencyRow: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emergencyRowCritical: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  emergencyRowUnread: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  emergencyRowInner: {
    padding: 16,
    gap: 12,
  },
  emergencyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  emergencyHeadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  emergencyHeadlineText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emergencyTime: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emergencyMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emergencyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  emergencyIconWrapCritical: {
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emergencyContent: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  emergencyTitleUnread: {
    color: '#7F1D1D',
  },
  emergencyBody: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '500',
  },
  emergencyLocationCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emergencyLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emergencyLocationLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  emergencyLocationAddress: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 20,
  },
  emergencyLocationCoords: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  emergencyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  emergencyCtaText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  emergencyUnreadBar: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  iconWrap: {
    position: 'relative',
    marginTop: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadRing: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  listRowContent: {
    flex: 1,
    minWidth: 0,
  },
  listRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  listRowHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  listRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  actionChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
  },
  notificationTitleUnread: {
    fontWeight: '700',
    color: '#0F172A',
  },
  notificationTitleDanger: {
    color: '#DC2626',
  },
  notificationTitleWarning: {
    color: '#D97706',
  },
  notificationBody: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  notificationBodyGreeting: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  alertBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  alertBadgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  alertBadgeAlert: {
    backgroundColor: '#FEE2E2',
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  listRowFooter: {
    marginTop: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 48,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
});
