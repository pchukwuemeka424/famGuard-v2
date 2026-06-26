import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  Animated,
  Image,
} from 'react-native';
import * as ExpoLocation from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useConnection } from '../context/ConnectionContext';
import { useAuth } from '../context/AuthContext';
import { useAppSetting } from '../context/AppSettingContext';
import { useTranslation } from '../context/LanguageContext';
import { locationService } from '../services/locationService';
import { incidentProximityService } from '../services/incidentProximityService';
import { supabase } from '../lib/supabase';
import type { MainTabParamList, RootStackParamList, Location } from '../types';
import type { FamilyMember } from '../types';
import HomeHeader from '../components/HomeHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';
const PROMO_FAMILY_IMAGE = require('../../assets/home/promo-family.png');
const KPI_LOCATION_BG = require('../../assets/home/hero-radar.png');

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { t } = useTranslation();
  const { connections, locationSharingEnabled, setLocationSharingEnabled, refreshConnections } = useConnection();
  const { user } = useAuth();
  const { hideReportIncident, sosLock } = useAppSetting();
  const insets = useSafeAreaInsets();
  const [togglingLocation, setTogglingLocation] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<Location>({
    latitude: 37.78825,
    longitude: -122.4324,
  });
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const locationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<Location | null>(null);
  const locationWatchSubscriptionRef = useRef<ExpoLocation.LocationSubscription | null>(null);
  const locationHistoryChannelRef = useRef<any>(null);
  const [showEmergencySentAlert, setShowEmergencySentAlert] = useState<boolean>(false);
  const alertScale = useRef(new Animated.Value(0)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;
  const emergencyNavigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedToLockedRef = useRef<boolean>(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [showLanguagePicker, setShowLanguagePicker] = useState<boolean>(false);
  const notificationChannelRef = useRef<any>(null);

  // Removed automatic location loading on mount
  // Location will only be requested when user toggles location sharing ON

  const updateUserLocationDebounced = useCallback((newLocation: Location) => {
    if (locationUpdateTimeoutRef.current) {
      clearTimeout(locationUpdateTimeoutRef.current);
    }

    if (lastLocationRef.current) {
      const distance = calculateDistance(
        lastLocationRef.current.latitude,
        lastLocationRef.current.longitude,
        newLocation.latitude,
        newLocation.longitude
      );

      if (distance < 10) {
        return;
      }
    }

    locationUpdateTimeoutRef.current = setTimeout(() => {
      setUserLocation(newLocation);
      lastLocationRef.current = newLocation;
    }, 500);
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Real-time location tracking and history saving
  useEffect(() => {
    if (!user?.id || !locationSharingEnabled) {
      // Clean up if location sharing is disabled
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
        locationWatchSubscriptionRef.current = null;
      }
      if (locationHistoryChannelRef.current) {
        supabase.removeChannel(locationHistoryChannelRef.current);
        locationHistoryChannelRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let locationUpdateInterval: NodeJS.Timeout | null = null;
    let initDelayTimeout: NodeJS.Timeout | null = null;
    const ONE_HOUR_MS = 3600000; // 1 hour in milliseconds

    // Start real-time location tracking
    const startLocationTracking = async () => {
      try {
        // iOS-specific: Check if location services are enabled first
        if (Platform.OS === 'ios') {
          try {
            const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
            if (!servicesEnabled) {
              console.warn('iOS: Location services are disabled');
              return;
            }
          } catch (error) {
            console.warn('iOS: Error checking location services:', error);
            // Continue anyway
          }
        }

        const hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          console.warn('Location permission not granted for real-time tracking');
          return;
        }

        // Check if component is still mounted before proceeding
        if (!isMounted) return;

        // Get initial location with high-accuracy GPS and save to history
        // Permission already checked above, so pass true to allow location access
        let initialLocation = null;
        try {
          initialLocation = await locationService.getHighAccuracyLocation(true);
        } catch (error) {
          console.error('Error getting initial location:', error);
          return;
        }

        if (initialLocation && isMounted) {
          // Get accuracy from GPS for initial location
          let initialAccuracy: number | null = null;
          try {
            const locationWithAccuracy = await ExpoLocation.getCurrentPositionAsync({
              accuracy: Platform.OS === 'ios' ? ExpoLocation.Accuracy.BestForNavigation : ExpoLocation.Accuracy.Highest,
              maximumAge: 0, // Force fresh location
              timeout: 20000,
            });
            initialAccuracy = locationWithAccuracy?.coords?.accuracy !== undefined && locationWithAccuracy?.coords?.accuracy !== null
              ? locationWithAccuracy.coords.accuracy
              : null;
          } catch (error) {
            console.warn('Could not get accuracy for initial location:', error);
          }

          // Check if component is still mounted
          if (!isMounted) return;
          
          // Will insert if no entry exists, or update if entry already exists, with accuracy
          try {
            await locationService.saveLocationToHistory(user.id, initialLocation, false, initialAccuracy);
          } catch (error) {
            console.error('Error saving initial location to history:', error);
          }

          updateUserLocationDebounced(initialLocation);
          
          // Trigger incident proximity check after initial location is saved
          incidentProximityService.triggerCheck().catch((error) => {
            console.error('Error triggering incident proximity check:', error);
          });
          
          if (__DEV__) {
            console.log('Initial location saved to history with accuracy:', initialAccuracy);
          }
        }

        // Set up periodic update every 1 hour - use high-accuracy GPS
        locationUpdateInterval = setInterval(async () => {
          if (!isMounted || !locationSharingEnabled) {
            return;
          }

          try {
            // Permission already granted when location sharing was enabled
            // Use high-accuracy GPS for periodic updates
            const currentLocation = await locationService.getHighAccuracyLocation(true);
            if (currentLocation) {
              // Get accuracy from GPS for better tracking
              let locationAccuracy: number | null = null;
              try {
                const locationWithAccuracy = await ExpoLocation.getCurrentPositionAsync({
                  accuracy: Platform.OS === 'ios' ? ExpoLocation.Accuracy.BestForNavigation : ExpoLocation.Accuracy.Highest,
                  maximumAge: 5000,
                  timeout: 10000,
                });
                locationAccuracy = locationWithAccuracy?.coords?.accuracy !== undefined && locationWithAccuracy?.coords?.accuracy !== null
                  ? locationWithAccuracy.coords.accuracy
                  : null;
              } catch (error) {
                // If we can't get accuracy, continue without it
                console.warn('Could not get accuracy for periodic update:', error);
              }
              
              // Will update existing row or insert if doesn't exist, with accuracy
              await locationService.saveLocationToHistory(user.id, currentLocation, false, locationAccuracy);
              updateUserLocationDebounced(currentLocation);
              
              // Trigger incident proximity check after location update
              incidentProximityService.triggerCheck().catch((error) => {
                console.error('Error triggering incident proximity check:', error);
              });
              
              if (__DEV__) {
                console.log('Location history updated (hourly update) with accuracy:', locationAccuracy);
              }
            }
          } catch (error) {
            console.error('Error in hourly location update:', error);
          }
        }, ONE_HOUR_MS);

        // Start watching location changes for UI updates with high-accuracy GPS
        // Use best accuracy settings for real-time tracking
        const subscription = await ExpoLocation.watchPositionAsync(
          {
            accuracy: Platform.OS === 'ios' 
              ? ExpoLocation.Accuracy.BestForNavigation 
              : ExpoLocation.Accuracy.Highest, // High-accuracy GPS for real-time updates
            timeInterval: 30000, // Check every 30 seconds for UI updates (reduced from 60s)
            distanceInterval: 5, // Update UI if moved 5 meters (reduced from 10m for better accuracy)
          },
          async (location) => {
            if (!isMounted) return;

            const newLocation: Location = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            // Update UI location only (not saving to history here - that's handled by locationService)
            // Real-time subscription will update UI when location_history is updated
            updateUserLocationDebounced(newLocation);
            
            if (__DEV__) {
              console.log('Real-time location update:', {
                lat: newLocation.latitude.toFixed(6),
                lng: newLocation.longitude.toFixed(6),
                accuracy: location.coords.accuracy,
              });
            }
          }
        );

        if (isMounted) {
          locationWatchSubscriptionRef.current = subscription;
        } else {
          subscription.remove();
        }
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    };

    // Set up real-time subscription to location_history
    const setupLocationHistorySubscription = () => {
      // Remove existing channel if any
      if (locationHistoryChannelRef.current) {
        supabase.removeChannel(locationHistoryChannelRef.current);
        locationHistoryChannelRef.current = null;
      }

      const channel = supabase
        .channel(`location_history:${user.id}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE', // Listen for UPDATE events (when location is updated)
            schema: 'public',
            table: 'location_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!isMounted) return;

            const updatedLocation = payload.new;
            if (updatedLocation && updatedLocation.latitude && updatedLocation.longitude) {
              const newLocation: Location = {
                latitude: updatedLocation.latitude,
                longitude: updatedLocation.longitude,
                address: updatedLocation.address || undefined,
              };

              // Update UI with the new location from database (real-time subscription)
              updateUserLocationDebounced(newLocation);

              if (__DEV__) {
                console.log('Location history updated via real-time (UPDATE):', {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                  address: newLocation.address,
                  accuracy: updatedLocation.accuracy,
                });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Listen for INSERT events (first time location is saved)
            schema: 'public',
            table: 'location_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!isMounted) return;

            const newEntry = payload.new;
            if (newEntry && newEntry.latitude && newEntry.longitude) {
              const newLocation: Location = {
                latitude: newEntry.latitude,
                longitude: newEntry.longitude,
                address: newEntry.address || undefined,
              };

              // Update UI with the new location from database (real-time subscription)
              updateUserLocationDebounced(newLocation);

              if (__DEV__) {
                console.log('Location history inserted via real-time (INSERT):', {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                  address: newLocation.address,
                  accuracy: newEntry.accuracy,
                });
              }
            }
          }
        )
        .subscribe((status) => {
          if (__DEV__) {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Successfully subscribed to location_history real-time updates');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Error subscribing to location_history real-time updates');
            } else if (status === 'TIMED_OUT') {
              console.warn('⚠️ Location history subscription timed out');
            } else if (status === 'CLOSED') {
              console.log('Location history subscription closed');
            }
          }
        });

      locationHistoryChannelRef.current = channel;
    };

    // iOS-specific: Add a small delay before starting location tracking
    // This prevents race conditions when the app reopens and multiple components
    // try to access location simultaneously
    if (Platform.OS === 'ios') {
      initDelayTimeout = setTimeout(() => {
        if (isMounted) {
          startLocationTracking();
        }
      }, 1500); // 1.5 second delay on iOS to prevent crashes
    } else {
      startLocationTracking();
    }
    
    setupLocationHistorySubscription();
    
    // Start periodic incident proximity checking
    incidentProximityService.startPeriodicChecking();

    return () => {
      isMounted = false;
      
      // Clear the init delay timeout if still pending
      if (initDelayTimeout) {
        clearTimeout(initDelayTimeout);
        initDelayTimeout = null;
      }
      
      // Stop periodic incident proximity checking
      incidentProximityService.stopPeriodicChecking();
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
        locationWatchSubscriptionRef.current = null;
      }
      if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        locationUpdateInterval = null;
      }
      if (locationHistoryChannelRef.current) {
        supabase.removeChannel(locationHistoryChannelRef.current);
        locationHistoryChannelRef.current = null;
      }
    };
  }, [user?.id, locationSharingEnabled, updateUserLocationDebounced]);

  // Load unread notification count
  useEffect(() => {
    if (!user?.id) return;

    const loadUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false);

        if (error) {
          console.error('Error loading unread notification count:', error);
          return;
        }

        setUnreadNotificationCount(count || 0);
      } catch (error) {
        console.error('Error loading unread notification count:', error);
      }
    };

    loadUnreadCount();

    // Set up real-time subscription for notifications
    const channel = supabase
      .channel(`notifications_count:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    notificationChannelRef.current = channel;

    return () => {
      if (notificationChannelRef.current) {
        supabase.removeChannel(notificationChannelRef.current);
      }
    };
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
      if (emergencyNavigationTimeoutRef.current) {
        clearTimeout(emergencyNavigationTimeoutRef.current);
        emergencyNavigationTimeoutRef.current = null;
      }
    };
  }, []);

  // Removed loadUserLocation - location is now only loaded when user enables location sharing

  const handleToggleLocationSharing = async (): Promise<void> => {
    try {
      setTogglingLocation(true);

      if (!locationSharingEnabled) {
        // Only request permission when user wants to enable location sharing
        const hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          const permissionResult = await locationService.requestPermissions();
          if (!permissionResult.granted) {
            Alert.alert(
              t('common.permissionRequired'),
              permissionResult.message || t('home.alertPermissionLocation'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { 
                  text: t('common.openSettings'), 
                  onPress: () => Linking.openSettings() 
                },
              ]
            );
            setTogglingLocation(false);
            return;
          }
        }

        // Get initial location with high-accuracy GPS only after permission is granted
        setLocationLoading(true);
        const initialLocation = await locationService.getHighAccuracyLocation(true); // Request permission if needed
        if (!initialLocation) {
          Alert.alert(
            t('home.alertLocationErrorTitle'),
            t('home.alertLocationError'),
            [{ text: t('common.ok') }]
          );
          setTogglingLocation(false);
          setLocationLoading(false);
          return;
        }

        // Get accuracy from GPS for high-accuracy tracking
        let locationAccuracy: number | null = null;
        try {
          const locationWithAccuracy = await ExpoLocation.getCurrentPositionAsync({
            accuracy: Platform.OS === 'ios' ? ExpoLocation.Accuracy.BestForNavigation : ExpoLocation.Accuracy.Highest,
            maximumAge: 0, // Force fresh location
            timeout: 20000, // Wait up to 20 seconds for accurate GPS
          });
          locationAccuracy = locationWithAccuracy?.coords?.accuracy !== undefined && locationWithAccuracy?.coords?.accuracy !== null
            ? locationWithAccuracy.coords.accuracy
            : null;
        } catch (error) {
          console.warn('Could not get accuracy when toggling location:', error);
        }

        // Update UI with initial location
        updateUserLocationDebounced(initialLocation);
        lastLocationRef.current = initialLocation;
        setLocationLoading(false);

        // Save location to location_history table with high-accuracy GPS data
        if (user?.id && initialLocation) {
          try {
            // Always insert a new row — never update or replace existing history
            await locationService.saveLocationToHistory(user.id, initialLocation, false, locationAccuracy);
            console.log('Location saved to history table with accuracy:', locationAccuracy);
          } catch (error) {
            console.error('Error saving location to history:', error);
            // Don't block the toggle if history save fails
          }
        }
      }

      const newValue = !locationSharingEnabled;
      await setLocationSharingEnabled(newValue);
      await refreshConnections();

      if (newValue) {
        console.log('Location sharing enabled - connections can now see your location');
      } else {
        console.log('Location sharing disabled - you are now offline to connections');
        // Clear location when sharing is disabled
        setUserLocation({
          latitude: 37.78825,
          longitude: -122.4324,
        });
        lastLocationRef.current = null;
      }
    } catch (error) {
      console.error('Error toggling location sharing:', error);
      Alert.alert(
        t('common.error'),
        t('home.alertUpdateFailed'),
        [{ text: t('common.ok') }]
      );
    } finally {
      setTogglingLocation(false);
      setLocationLoading(false);
    }
  };


  const handleOfflineEmergency = async (): Promise<void> => {
    try {
      // Check if there are any connections
      if (connections.length === 0) {
        Alert.alert(
          t('home.alertNoConnectionsTitle'),
          t('home.alertNoConnectionsSms'),
          [{ text: t('common.ok') }]
        );
        return;
      }

      // Filter connections that have phone numbers
      const connectionsWithPhone = connections.filter(conn => conn.phone && conn.phone.trim() !== '');
      
      if (connectionsWithPhone.length === 0) {
        Alert.alert(
          t('home.alertNoConnectionsTitle'),
          t('home.alertNoPhoneNumbers'),
          [{ text: t('common.ok') }]
        );
        return;
      }

      // Get the last known location as fallback
      let locationToUse = lastLocationRef.current || userLocation;
      
      // For emergency SMS, use HIGH-ACCURACY GPS to ensure precise location
      // Request permission if needed - this is an emergency situation
      try {
        // Use high-accuracy GPS for emergency SMS - most precise location possible
        const currentLocation = await locationService.getHighAccuracyLocation(true);
        if (currentLocation) {
          locationToUse = currentLocation;
          console.log('Emergency SMS: High-accuracy location retrieved');
        } else {
          console.log('Emergency SMS: Using last known location (high-accuracy unavailable)');
        }
      } catch (error) {
        console.log('Emergency SMS: Using last known location (error getting high-accuracy GPS):', error);
      }

      // Format location message
      const userName = user?.name || t('common.someone');
      const timestamp = new Date().toLocaleString();
      let message = `🚨 EMERGENCY ALERT - ${userName} needs help!\n\n`;
      
      if (locationToUse && locationToUse.latitude && locationToUse.longitude) {
        message += `📍 Location:\n`;
        if (locationToUse.address) {
          message += `${locationToUse.address}\n`;
        }
        message += `Coordinates: ${locationToUse.latitude.toFixed(6)}, ${locationToUse.longitude.toFixed(6)}\n`;
        message += `Google Maps: https://maps.google.com/?q=${locationToUse.latitude},${locationToUse.longitude}\n`;
      } else {
        message += `⚠️ Location unavailable\n`;
      }
      
      message += `\n🕐 Time: ${timestamp}\n`;
      message += `\nPlease send help immediately!`;

      // If only one connection with phone, send directly
      if (connectionsWithPhone.length === 1) {
        await sendSMSToConnection(connectionsWithPhone[0], message);
        return;
      }

      // Show selection dialog for multiple connections
      const connectionOptions = connectionsWithPhone.map(conn => ({
        text: conn.name,
        onPress: () => sendSMSToConnection(conn, message),
      }));

      Alert.alert(
        t('home.alertSelectConnectionTitle'),
        t('home.alertSelectConnectionMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          ...connectionOptions,
        ]
      );
    } catch (error) {
      console.error('Error in offline emergency:', error);
      Alert.alert(
        t('common.error'),
        t('home.alertEmergencyPrepFailed'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const sendSMSToConnection = async (connection: FamilyMember, message: string): Promise<void> => {
    try {
      if (!connection.phone || connection.phone.trim() === '') {
        Alert.alert(
          t('home.alertNoConnectionsTitle'),
          t('home.alertNoPhoneNumber', { name: connection.name }),
          [{ text: t('common.ok') }]
        );
        return;
      }

      // Clean phone number (remove spaces, dashes, etc.)
      const cleanPhone = connection.phone.replace(/[\s\-\(\)]/g, '');
      
      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);
      
      // Create SMS URL with phone number and message
      // Format: sms:PHONE_NUMBER?body=MESSAGE (Android) or sms:PHONE_NUMBER&body=MESSAGE (iOS)
      const smsUrl = Platform.OS === 'ios' 
        ? `sms:${cleanPhone}&body=${encodedMessage}`
        : `sms:${cleanPhone}?body=${encodedMessage}`;
      
      const canOpen = await Linking.canOpenURL(smsUrl);
      let smsOpened = false;
      
      if (canOpen) {
        await Linking.openURL(smsUrl);
        smsOpened = true;
        Alert.alert(
          t('common.success'),
          t('home.alertMessageReady', { name: connection.name }),
          [{ text: t('common.ok') }]
        );
      } else {
        // Fallback: try with just phone number
        const fallbackUrl = `sms:${cleanPhone}`;
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
          smsOpened = true;
          Alert.alert(
            t('home.emergencySentTitle'),
            t('home.alertSmsOpened', { name: connection.name, message }),
            [{ text: t('common.ok') }]
          );
        } else {
          Alert.alert(
            t('common.error'),
            t('home.alertSmsOpenFailed', { name: connection.name }),
            [{ text: t('common.ok') }]
          );
          return;
        }
      }

      // If SMS was successfully opened, lock the user and navigate to locked screen
      if (smsOpened && user?.id) {
        try {
          // Start emergency background tracking so location continues when app is backgrounded
          try {
            await locationService.startEmergencyTracking(user.id);
            console.log('Emergency tracking started after offline SMS alert');
          } catch (trackingError) {
            console.error('Error starting emergency tracking after offline SMS:', trackingError);
          }

          // Lock the user after offline emergency
          const { error: lockError } = await supabase
            .from('users')
            .update({ is_locked: true })
            .eq('id', user.id);

          if (lockError) {
            console.error('Error locking user:', lockError);
          } else {
            console.log('User locked after offline emergency');
          }

          // Reset navigation flag
          hasNavigatedToLockedRef.current = false;
          
          // Navigate to locked screen after a short delay
          setTimeout(() => {
            if (!hasNavigatedToLockedRef.current) {
              hasNavigatedToLockedRef.current = true;
              navigation.navigate('Locked');
            }
          }, 2000);
        } catch (error) {
          console.error('Error locking user after offline emergency:', error);
        }
      }
    } catch (error) {
      console.error('Error sending SMS to connection:', error);
      Alert.alert(
        t('common.error'),
        t('home.alertSmsFailed', { name: connection.name }),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleSOS = async (): Promise<void> => {
    try {
      // Reset navigation flag and clear any existing timeout
      hasNavigatedToLockedRef.current = false;
      if (emergencyNavigationTimeoutRef.current) {
        clearTimeout(emergencyNavigationTimeoutRef.current);
        emergencyNavigationTimeoutRef.current = null;
      }

      if (connections.length === 0) {
        Alert.alert(
          t('home.alertNoConnectionsTitle'),
          t('home.alertNoConnectionsSos'),
          [{ text: t('common.ok') }]
        );
        return;
      }

      Alert.alert(
        t('home.alertSendEmergencyTitle'),
        t('home.alertSendEmergencyMessage', { count: connections.length }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('home.alertSendEmergencyButton'),
            style: 'destructive',
            onPress: async () => {
              try {
                // Request permission for emergency - use HIGH-ACCURACY GPS for emergency situations
                // This ensures the most precise location is sent during emergencies
                const currentLocation = await locationService.getHighAccuracyLocation(true);
                if (!currentLocation) {
                  Alert.alert(
                    t('home.alertLocationErrorTitle'),
                    t('home.alertLocationErrorSos'),
                    [{ text: t('common.ok') }]
                  );
                }

                const userName = user?.name || t('common.someone');
                const timestamp = new Date();
                const locationData = currentLocation
                  ? {
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      address: currentLocation.address || undefined,
                    }
                  : null;

                let locationInfo = '';
                if (locationData) {
                  if (locationData.address) {
                    locationInfo = `\n📍 ${locationData.address}`;
                  }
                  locationInfo += `\n🌐 ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
                  locationInfo += `\n🕐 ${timestamp.toLocaleTimeString()}`;
                }

                // Get all connected user IDs for push notifications
                const getConnectedUserIds = async (): Promise<string[]> => {
                  if (!user?.id) return [];
                  
                  try {
                    // Get connections where this user is the main user
                    const { data: connections1, error: error1 } = await supabase
                      .from('connections')
                      .select('connected_user_id')
                      .eq('user_id', user.id)
                      .eq('status', 'connected');

                    // Get connections where this user is the connected user
                    const { data: connections2, error: error2 } = await supabase
                      .from('connections')
                      .select('user_id')
                      .eq('connected_user_id', user.id)
                      .eq('status', 'connected');

                    if (error1 || error2) {
                      console.error('Error fetching connected users:', error1 || error2);
                      return [];
                    }

                    const userIds = new Set<string>();
                    (connections1 || []).forEach((conn) => {
                      if (conn.connected_user_id) userIds.add(conn.connected_user_id);
                    });
                    (connections2 || []).forEach((conn) => {
                      if (conn.user_id) userIds.add(conn.user_id);
                    });

                    return Array.from(userIds);
                  } catch (error) {
                    console.error('Error in getConnectedUserIds:', error);
                    return [];
                  }
                };

                // Send push notifications to all connected users
                const connectedUserIds = await getConnectedUserIds();
                
                console.log('📱 Sending push notifications to connected users:', {
                  count: connectedUserIds.length,
                  userIds: connectedUserIds,
                });
                
                if (connectedUserIds.length === 0) {
                  console.warn('⚠️ No connected users found - push notifications will not be sent');
                }
                
                // Create notifications for all connected users
                if (connectedUserIds.length > 0) {
                  try {
                    const notificationEntries = connectedUserIds.map((connectedUserId) => ({
                      user_id: connectedUserId,
                      title: '🚨 Emergency Alert',
                      body: `${userName} needs help!${locationInfo}`,
                      type: 'sos_alert',
                      data: {
                        type: 'sos_alert',
                        userId: user?.id,
                        userName: userName,
                        location: locationData,
                        timestamp: timestamp.toISOString(),
                      },
                      read: false,
                    }));

                    const { error: notificationError } = await supabase
                      .from('notifications')
                      .insert(notificationEntries);

                    if (notificationError) {
                      console.error('Error creating notifications:', notificationError);
                    } else {
                      console.log(`Created ${notificationEntries.length} notifications for emergency alert`);
                    }
                  } catch (error) {
                    console.error('Error creating notifications:', error);
                    // Don't fail the emergency alert if notification creation fails
                  }
                }
                
                if (connectedUserIds.length > 0) {
                  try {
                    // Get Supabase URL and anon key for direct function call
                    const getEnvVar = (key: string): string | undefined => {
                      if (process.env[key]) {
                        const value = process.env[key];
                        if (typeof value === 'string' && value.includes('${')) {
                          return undefined;
                        }
                        if (value && value.trim() !== '') {
                          return value;
                        }
                      }
                      if (Constants.expoConfig?.extra?.[key]) {
                        const value = Constants.expoConfig.extra[key];
                        if (typeof value === 'string' && value.includes('${')) {
                          return undefined;
                        }
                        return value;
                      }
                      return undefined;
                    };

                    // Call Edge Function to send push notifications
                    // Function is deployed with --no-verify-jwt so it doesn't require authentication
                    try {
                      const pushNotificationBody = {
                        user_ids: connectedUserIds,
                        title: '🚨 Emergency Alert',
                        body: `${userName} needs help!${locationInfo}`,
                        data: {
                          type: 'sos_alert',
                          userId: user?.id,
                          userName: userName,
                          location: locationData,
                          timestamp: timestamp.toISOString(),
                        },
                      };

                      // Use supabase.functions.invoke() - handles authentication automatically
                      const { data: pushResult, error: functionError } = await supabase.functions.invoke(
                        'send-push-notification',
                        {
                          body: pushNotificationBody,
                        }
                      );

                      if (functionError) {
                        console.error('❌ Error calling push notification function:', {
                          error: functionError,
                          message: functionError.message,
                          details: functionError.details,
                          status: functionError.status,
                        });
                        Alert.alert(
                          'Push Notification Error',
                          `Failed to send push notifications: ${functionError.message || 'Unknown error'}\n\nCheck Edge Function logs for details.`
                        );
                      } else if (pushResult) {
                        const sentCount = pushResult.sent || 0;
                        const failedCount = pushResult.failed || 0;
                        const total = pushResult.total || connectedUserIds.length;
                        const message = pushResult.message || '';
                        
                        console.log('📊 Push notification result:', {
                          sent: sentCount,
                          failed: failedCount,
                          total: total,
                          message: message,
                          requested_users: connectedUserIds.length,
                        });
                        
                        if (sentCount > 0) {
                          console.log(`✅ Push notifications sent: ${sentCount} successful, ${failedCount} failed`);
                        } else if (message) {
                          console.warn(`⚠️ Push notifications: ${message}`);
                          // Show alert if no tokens found
                          if (message.includes('No push tokens found')) {
                            Alert.alert(
                              'No Push Tokens',
                              `None of the ${total} connected users have push tokens registered.\n\nThey need to log in and grant notification permission.`
                            );
                          }
                        } else {
                          console.log('✅ Push notification request completed');
                        }
                      }
                    } catch (invokeError: any) {
                      console.error('Exception calling push notification function:', {
                        error: invokeError,
                        message: invokeError?.message,
                        stack: invokeError?.stack,
                      });
                    }
                  } catch (error: any) {
                    console.error('Error sending push notifications:', {
                      message: error?.message,
                      error: error,
                    });
                    // Don't fail the emergency alert if push notifications fail
                  }
                }

                // Emergency alerts sent
                const successful = connections.length;
                const failed = 0;

                if (successful > 0) {
                  // Start emergency tracking (native background + foreground intervals)
                  if (user?.id) {
                    try {
                      await locationService.startEmergencyTracking(user.id);
                      console.log('Emergency tracking started (background + foreground)');
                    } catch (error) {
                      console.error('Error starting emergency tracking:', error);
                      // Don't fail the alert if tracking fails to start
                    }
                  }

                  // Lock the user after emergency alert
                  if (user?.id) {
                    try {
                      const { error: lockError } = await supabase
                        .from('users')
                        .update({ is_locked: true })
                        .eq('id', user.id);

                      if (lockError) {
                        console.error('Error locking user:', lockError);
                      } else {
                        console.log('User locked after emergency alert');
                      }
                    } catch (error) {
                      console.error('Error locking user:', error);
                    }
                  }

                  // Show modern confirmation alert
                  setShowEmergencySentAlert(true);
                  Animated.parallel([
                    Animated.spring(alertScale, {
                      toValue: 1,
                      useNativeDriver: true,
                      tension: 50,
                      friction: 7,
                    }),
                    Animated.timing(alertOpacity, {
                      toValue: 1,
                      duration: 300,
                      useNativeDriver: true,
                    }),
                  ]).start();

                  // Auto-dismiss and navigate after 4 seconds
                  emergencyNavigationTimeoutRef.current = setTimeout(() => {
                    // Prevent duplicate navigation
                    if (hasNavigatedToLockedRef.current) {
                      return;
                    }

                    Animated.parallel([
                      Animated.timing(alertScale, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                      Animated.timing(alertOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                    ]).start(() => {
                      setShowEmergencySentAlert(false);
                      // Navigate to locked screen only if not already navigated
                      if (!hasNavigatedToLockedRef.current) {
                        hasNavigatedToLockedRef.current = true;
                        navigation.navigate('Locked');
                      }
                    });
                  }, 4000);
                } else {
                  Alert.alert(
                    t('home.alertEmergencyFailedTitle'),
                    t('home.alertEmergencyFailed'),
                    [{ text: t('common.ok') }]
                  );
                }
              } catch (error) {
                console.error('Error sending SOS alerts:', error);
                Alert.alert(
                  t('common.error'),
                  t('home.alertEmergencySendFailed'),
                  [{ text: t('common.ok') }]
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleSOS:', error);
      Alert.alert(
        t('common.error'),
        t('home.alertGenericError'),
        [{ text: t('common.ok') }]
      );
    }
  };



  return (
    <View style={styles.container}>
      <HomeHeader
        paddingTop={insets.top + 8}
        locationSharingEnabled={locationSharingEnabled}
        connectionCount={connections.length}
        unreadCount={unreadNotificationCount}
        userName={user?.name}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        onLanguagePress={() => setShowLanguagePicker(true)}
      />

      <ScrollView
        style={styles.mainContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Promo Banner */}
        <View style={styles.promoWrap}>
          <LinearGradient
            colors={['#EAF1FF', '#F4F8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoCard}
          >
            <View style={styles.promoTextWrap}>
              <Text style={styles.promoTitle}>{t('home.promoTitle')}</Text>
              <Text style={styles.promoSubtitle}>{t('home.promoSubtitle')}</Text>
            </View>
            <Image source={PROMO_FAMILY_IMAGE} style={styles.promoImage} resizeMode="contain" />
          </LinearGradient>
        </View>

        {/* Location Sharing KPI */}
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              locationSharingEnabled ? styles.kpiCardActive : styles.kpiCardInactive,
            ]}
          >
            <Image
              source={KPI_LOCATION_BG}
              style={[
                styles.kpiBgImage,
                !locationSharingEnabled && styles.kpiBgImageInactive,
              ]}
              resizeMode="contain"
            />
            <View style={styles.kpiContent}>
              <View style={styles.kpiTopRow}>
                <View style={styles.kpiTextWrap}>
                  <Text style={styles.kpiLabel}>{t('home.locationSharing')}</Text>
                  <Text style={styles.kpiStatus}>
                    {togglingLocation ? '···' : locationSharingEnabled ? t('common.on') : t('common.off')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.kpiToggle,
                    locationSharingEnabled && styles.kpiToggleActive,
                    togglingLocation && styles.kpiToggleDisabled,
                  ]}
                  onPress={handleToggleLocationSharing}
                  disabled={togglingLocation}
                  activeOpacity={0.8}
                >
                  {togglingLocation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={[styles.kpiToggleThumb, locationSharingEnabled && styles.kpiToggleThumbActive]} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.kpiSubtitle}>
                {locationSharingEnabled
                  ? t('home.locationVisible')
                  : t('home.locationHidden')}
              </Text>
            </View>
          </View>
        </View>

        {/* Emergency Actions Section */}
        <View style={styles.section}>
          <View style={styles.emergencyGrid}>
            <TouchableOpacity
              style={[styles.emergencyCard, styles.sosCard]}
              onPress={handleSOS}
              activeOpacity={0.9}
            >
              <View style={styles.emergencyBadge}>
                <Text style={styles.sosBadgeText}>{t('home.sosBadge')}</Text>
              </View>
              <Text style={[styles.emergencyTitle, styles.emergencyTitleSingleLine]} numberOfLines={1}>
                {t('home.emergencyAlert')}
              </Text>
              <Text style={styles.emergencySubtitle} numberOfLines={2}>
                {t('home.emergencyAlertSubtitle')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.emergencyCard, styles.smsCard]}
              onPress={handleOfflineEmergency}
              activeOpacity={0.9}
            >
              <View style={styles.emergencyBadge}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.emergencyTitle}>{t('home.smsEmergency')}</Text>
              <Text style={styles.emergencySubtitle}>{t('home.smsEmergencySubtitle')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Grid */}
        {!hideReportIncident && (
          <View style={styles.section}>
            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => navigation.navigate('ReportIncident')}
                activeOpacity={0.85}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="clipboard" size={20} color="#EF4444" />
                </View>
                <Text style={styles.quickTitle}>{t('home.reportIncident')}</Text>
                <Text style={styles.quickSubtitle}>{t('home.reportIncidentSubtitle')}</Text>
                <View style={styles.quickArrow}>
                  <Ionicons name="chevron-forward" size={14} color="#EF4444" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCard}
                onPress={() => navigation.navigate('CheckIn')}
                activeOpacity={0.85}
              >
                <View style={[styles.quickIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                </View>
                <Text style={styles.quickTitle}>{t('home.safetyCheckIn')}</Text>
                <Text style={styles.quickSubtitle}>{t('home.safetyCheckInSubtitle')}</Text>
                <View style={styles.quickArrow}>
                  <Ionicons name="chevron-forward" size={14} color="#10B981" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity
          style={styles.languageModalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.languageModalCard}>
            <View style={styles.languageModalHeader}>
              <Ionicons name="globe-outline" size={22} color="#10B981" />
              <Text style={styles.languageModalTitle}>{t('languageRegion.language')}</Text>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <LanguageSwitcher />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modern Emergency Sent Alert Modal */}
      <Modal
        visible={showEmergencySentAlert}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >
        <View style={styles.alertOverlay}>
          <Animated.View
            style={[
              styles.alertContainer,
              {
                transform: [{ scale: alertScale }],
                opacity: alertOpacity,
              },
            ]}
          >
            <View style={styles.alertIconContainer}>
              <View style={styles.alertIconBackground}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
            </View>
            <Text style={styles.alertTitle}>{t('home.emergencySentTitle')}</Text>
            <Text style={styles.alertMessage}>
              {t('home.emergencySentMessage')}
            </Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Promo banner
  promoWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  kpiGrid: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  kpiCard: {
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  kpiCardActive: {
    backgroundColor: '#10B981',
  },
  kpiCardInactive: {
    backgroundColor: '#64748B',
  },
  kpiBgImage: {
    position: 'absolute',
    width: 150,
    height: 150,
    right: -20,
    top: '50%',
    marginTop: -75,
    opacity: 0.4,
  },
  kpiBgImageInactive: {
    opacity: 0.25,
  },
  kpiContent: {
    position: 'relative',
    zIndex: 1,
    paddingRight: 72,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiTextWrap: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: -0.2,
  },
  kpiStatus: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  kpiSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 12,
    lineHeight: 16,
  },
  kpiToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    padding: 3,
  },
  kpiToggleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  kpiToggleDisabled: {
    opacity: 0.6,
  },
  kpiToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  kpiToggleThumbActive: {
    alignSelf: 'flex-end',
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 26,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 14,
    letterSpacing: -0.3,
  },

  // Emergency
  emergencyGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  emergencyCard: {
    flex: 1,
    borderRadius: 22,
    padding: 18,
    minHeight: 132,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  sosCard: {
    backgroundColor: '#EF4444',
  },
  smsCard: {
    backgroundColor: '#F59E0B',
  },
  emergencyBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  sosBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  emergencyTitleSingleLine: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  emergencySubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },

  // Quick actions
  quickGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    minHeight: 132,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  quickSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    fontWeight: '500',
  },
  quickArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // KPI cards
  promoCard: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 120,
  },
  promoTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  promoSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
  promoImage: {
    width: 130,
    height: 110,
  },

  bottomSpacing: {
    height: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  alertIconContainer: {
    marginBottom: 24,
  },
  alertIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  languageModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  languageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  languageModalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
});

