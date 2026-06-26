import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import * as ExpoLocation from 'expo-location';
import { useIncidents } from '../context/IncidentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { locationService } from '../services/locationService';
import { offlineMapsService } from '../services/offlineMapsService';
import { supabase } from '../lib/supabase';
import type { RootStackParamList, Location } from '../types';

type MapScreenRouteProp = RouteProp<RootStackParamList, 'MapView'>;
type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MapView'>;

interface MapScreenProps {
  route: MapScreenRouteProp;
  navigation: MapScreenNavigationProp;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;

type MapLayerType = 'hybrid' | 'standard' | 'satellite';

const MAP_LAYER_CYCLE: MapLayerType[] = ['hybrid', 'standard', 'satellite'];

export default function MapScreen({ route, navigation }: MapScreenProps) {
  const { t } = useTranslation();
  const { location, title, showUserLocation = true, userId } = route.params;
  const { userLocation: incidentUserLocation } = useIncidents();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [mapLayer, setMapLayer] = useState<MapLayerType>('hybrid');

  const mapLayerLabels: Record<MapLayerType, string> = {
    hybrid: t('map.mapLayerHybrid'),
    standard: t('map.mapLayerStandard'),
    satellite: t('map.mapLayerSatellite'),
  };
  
  // targetUserId is the user whose location we're viewing
  // If userId is provided (viewing someone else), use that
  // Otherwise, use current user's ID (viewing own location)
  const targetUserId = userId || user?.id;
  
  if (__DEV__) {
    console.log('MapScreen initialized:', {
      targetUserId,
      userId,
      currentUserId: user?.id,
      showUserLocation,
      hasLocation: !!location,
    });
  }
  
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location>(location); // Live location of the connected user (or current user if viewing own location)
  const [locationHistory, setLocationHistory] = useState<Array<Location & { timestamp: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<number | null>(null);
  const [hasOfflineMap, setHasOfflineMap] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState<number>(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [hasLocationHistory, setHasLocationHistory] = useState<boolean>(true); // Track if location_history exists for target user
  const realtimeChannelRef = useRef<any>(null);
  const connectionsRealtimeChannelRef = useRef<any>(null);
  const pendingUpdatesRef = useRef<Array<Location & { timestamp: string }>>([]);
  const locationWatchSubscriptionRef = useRef<ExpoLocation.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hasRequestedBackgroundPermissionRef = useRef<boolean>(false);
  const lastDestinationLocationRef = useRef<Location | null>(null);
  const lastUserLocationRef = useRef<Location | null>(null);
  const locationHistoryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationHistorySaveRef = useRef<number>(0);
  const hasInitializedLocationRef = useRef<boolean>(false);
  const hasInitializedSubscriptionsRef = useRef<boolean>(false);
  const isFetchingLocationRef = useRef<boolean>(false);
  const initialMapRegionRef = useRef<Region>(
    location?.latitude && location?.longitude
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
          longitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
        }
      : {
          latitude: 0,
          longitude: 0,
          latitudeDelta: 0.0006,
          longitudeDelta: 0.0006,
        }
  );
  const mapRegionRef = useRef<Region>(initialMapRegionRef.current);
  const hasAutoFocusedMapRef = useRef(false);
  const hasCenteredWithPaddingRef = useRef(false);

  const showTimelinePanel = Boolean(targetUserId && hasLocationHistory);

  const mapPadding = useMemo(
    () => ({
      top: insets.top + 96,
      right: 80,
      bottom: showTimelinePanel
        ? BOTTOM_SHEET_HEIGHT + 80
        : insets.bottom + 88,
      left: 16,
    }),
    [insets.top, insets.bottom, showTimelinePanel]
  );

  const animateMapToRegion = React.useCallback((region: Region, duration = 500) => {
    mapRegionRef.current = region;
    mapRef.current?.animateToRegion(region, duration);
  }, []);

  useEffect(() => {
    const checkOfflineMap = async () => {
      if (location && location.latitude && location.longitude) {
        const isCovered = await offlineMapsService.isLocationCovered(
          location.latitude,
          location.longitude
        );
        setHasOfflineMap(isCovered);
      }
    };
    checkOfflineMap();
  }, [location]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = React.useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Function to fetch user location (can be called from multiple places)
  const fetchUserLocation = React.useCallback(async (forceRefresh: boolean = false) => {
    // Don't show current user location if viewing another user and they have no location_history
    if (!showUserLocation || (userId && userId !== user?.id && !hasLocationHistory)) return;

    // Prevent concurrent fetches
    if (isFetchingLocationRef.current && !forceRefresh) {
      if (__DEV__) {
        console.log('Location fetch already in progress, skipping...');
      }
      return;
    }

    isFetchingLocationRef.current = true;

    try {
      // Check if location services are enabled (especially important on iOS)
      const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.warn('Location services are disabled. Please enable them in Settings.');
        setLoading(false);
        return;
      }

      // Request permissions first (foreground and background)
      const permissionResult = await locationService.requestPermissions();
      if (!permissionResult.granted) {
        console.warn('Location permission not granted:', permissionResult.message);
        setLoading(false);
        return;
      }

      // Request background permissions if not already requested (for getting location in background)
      if (!hasRequestedBackgroundPermissionRef.current && Platform.OS === 'android') {
        try {
          const { status: backgroundStatus } = await ExpoLocation.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('Background location permission granted');
          } else {
            console.warn('Background location permission denied - location will still work in foreground');
          }
          hasRequestedBackgroundPermissionRef.current = true;
        } catch (bgError) {
          console.warn('Background permission request failed:', bgError);
        }
      } else if (!hasRequestedBackgroundPermissionRef.current && Platform.OS === 'ios') {
        try {
          const { status: backgroundStatus } = await ExpoLocation.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('Background location permission granted on iOS');
          } else {
            console.warn('Background location permission denied on iOS - location will still work in foreground');
          }
          hasRequestedBackgroundPermissionRef.current = true;
        } catch (bgError) {
          console.warn('Background permission request failed on iOS:', bgError);
        }
      }

      // Use high accuracy location for exact positioning (works in both foreground and background)
      // On iOS, request location with best accuracy
      const currentLocation = await locationService.getHighAccuracyLocation(true);
      if (currentLocation) {
        setUserLocation(currentLocation);
        lastUserLocationRef.current = currentLocation; // Initialize last location
        
        // Log location accuracy for debugging
        if (__DEV__) {
          console.log('Current user location fetched (foreground/background):', {
            lat: currentLocation.latitude.toFixed(6),
            lng: currentLocation.longitude.toFixed(6),
            platform: Platform.OS,
            appState: appStateRef.current,
          });
        }
        
        // Update map region to show both current user and destination locations
        // If both locations are close, zoom in to show exact location
        if (destinationLocation && destinationLocation.latitude && destinationLocation.longitude) {
          const minLat = Math.min(currentLocation.latitude, destinationLocation.latitude);
          const maxLat = Math.max(currentLocation.latitude, destinationLocation.latitude);
          const minLng = Math.min(currentLocation.longitude, destinationLocation.longitude);
          const maxLng = Math.max(currentLocation.longitude, destinationLocation.longitude);
          const latDelta = (maxLat - minLat) * 1.5;
          const lngDelta = (maxLng - minLng) * 1.5;
          
          // If locations are very close, use tight zoom for exact location
          // Otherwise, show both locations but still zoomed in
          const isClose = latDelta < 0.001 && lngDelta < 0.001;
          const currentRegion = {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: isClose 
              ? (Platform.OS === 'ios' ? 0.0006 : 0.001) // Zoomed in for exact location
              : Math.max(latDelta, Platform.OS === 'ios' ? 0.0006 : 0.001), // Still zoomed in
            longitudeDelta: isClose
              ? (Platform.OS === 'ios' ? 0.0006 : 0.001) // Zoomed in for exact location
              : Math.max(lngDelta, Platform.OS === 'ios' ? 0.0006 : 0.001), // Still zoomed in
          };
          if (!hasAutoFocusedMapRef.current) {
            hasAutoFocusedMapRef.current = true;
            setTimeout(() => {
              animateMapToRegion(currentRegion, 1000);
            }, 500);
          }
        } else {
          // Only current user location available
          const currentRegion = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: Platform.OS === 'ios' ? 0.004 : 0.01,
            longitudeDelta: Platform.OS === 'ios' ? 0.004 : 0.01,
          };
          if (!hasAutoFocusedMapRef.current) {
            hasAutoFocusedMapRef.current = true;
            setTimeout(() => {
              animateMapToRegion(currentRegion, 1000);
            }, 500);
          }
        }
      } else if (incidentUserLocation) {
        setUserLocation(incidentUserLocation);
      }

      // Start watching location changes for real-time updates (works in both foreground and background)
      // Use iOS-specific settings for better accuracy
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
      }

      // High-accuracy GPS settings optimized for Nigeria and regions with GPS challenges
      // Use maximumAge: 0 to prevent cached location data
      const watchOptions = Platform.OS === 'ios' 
        ? {
            accuracy: ExpoLocation.Accuracy.BestForNavigation, // Best accuracy for iOS
            timeInterval: 2000, // Update every 2 seconds on iOS for real-time tracking
            distanceInterval: 1, // Update every 1 meter on iOS for precise tracking
            mayShowUserSettings: false, // Don't show settings dialog
          }
        : {
            accuracy: ExpoLocation.Accuracy.Highest, // Highest accuracy for Android
            timeInterval: 3000, // Update every 3 seconds on Android (reduced from 5s for better accuracy)
            distanceInterval: 1, // Update every 1 meter on Android (reduced from 5m for better accuracy)
            mayShowUserSettings: false, // Don't show settings dialog
          };

      locationWatchSubscriptionRef.current = await ExpoLocation.watchPositionAsync(
        watchOptions,
        (newLocation) => {
          // Use ref to get current userLocation to avoid closure issues
          const currentUserLocation = lastUserLocationRef.current;
          const updatedLocation: Location = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            address: currentUserLocation?.address, // Preserve address from ref
          };

          // Check if user has moved significantly (more than 10 meters) to avoid unnecessary updates
          const MIN_DISTANCE_THRESHOLD = 10; // 10 meters for current user
          const lastLocation = lastUserLocationRef.current;
          
          if (lastLocation) {
            const distance = calculateDistance(
              lastLocation.latitude,
              lastLocation.longitude,
              updatedLocation.latitude,
              updatedLocation.longitude
            );

            // Only update if user has moved significantly
            if (distance < MIN_DISTANCE_THRESHOLD) {
              // User hasn't moved significantly, skip update and logging
              return;
            }
          }

          // Update state and ref
          setUserLocation(updatedLocation);
          lastUserLocationRef.current = updatedLocation;
          
          // Log accuracy for debugging (only when user moves, and less frequently)
          if (__DEV__) {
            const distanceMoved = lastLocation 
              ? calculateDistance(
                  lastLocation.latitude,
                  lastLocation.longitude,
                  updatedLocation.latitude,
                  updatedLocation.longitude
                ).toFixed(1)
              : 'initial';
            // Only log if moved more than 50 meters to reduce console spam
            if (!lastLocation || parseFloat(distanceMoved) > 50) {
            console.log('Location updated (foreground/background):', {
              lat: updatedLocation.latitude.toFixed(6),
              lng: updatedLocation.longitude.toFixed(6),
              accuracy: newLocation.coords.accuracy,
              distanceMoved: `${distanceMoved}m`,
              platform: Platform.OS,
              appState: appStateRef.current,
            });
            }
          }
        }
      );
    } catch (error) {
      console.error('Error fetching user location:', error);
    } finally {
      setLoading(false);
      isFetchingLocationRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserLocation, incidentUserLocation, location, calculateDistance, animateMapToRegion]);

  // Initial fetch on mount (only once)
  useEffect(() => {
    // Don't fetch user location if viewing another user without location_history
    if (showUserLocation && !hasInitializedLocationRef.current && !(userId && userId !== user?.id && !hasLocationHistory)) {
      hasInitializedLocationRef.current = true;
      fetchUserLocation();
    } else if (!showUserLocation || (userId && userId !== user?.id && !hasLocationHistory)) {
      // When viewing someone else's location, don't fetch current user's location
      // Also don't fetch if viewing another user without location_history
      setLoading(false);
      hasInitializedLocationRef.current = false; // Reset when showUserLocation changes
      // Center map on destination location only - zoomed in for exact location
      // But only if location_history exists
      if (hasLocationHistory && destinationLocation && destinationLocation.latitude && destinationLocation.longitude) {
        const region: Region = {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
          latitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
          longitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
        };
        if (!hasAutoFocusedMapRef.current) {
          hasAutoFocusedMapRef.current = true;
          setTimeout(() => {
            animateMapToRegion(region, 1000);
          }, 500);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserLocation, destinationLocation, hasLocationHistory, userId, user?.id, animateMapToRegion]);

  // Handle app state changes (foreground/background) - refresh location when app comes to foreground
  useEffect(() => {
    if (!showUserLocation) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground - refresh location
        console.log('App came to foreground, refreshing location...');
        fetchUserLocation(true); // Force refresh
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [showUserLocation, fetchUserLocation]);

  // Refresh location when screen comes into focus (e.g., after device unlock or navigation)
  useFocusEffect(
    React.useCallback(() => {
      if (showUserLocation) {
        // Only fetch if not already initialized or if explicitly needed
        if (!hasInitializedLocationRef.current) {
          console.log('MapScreen focused, initializing location...');
          hasInitializedLocationRef.current = true;
        fetchUserLocation(true); // Force refresh
        } else {
          // Just refresh location without re-initializing subscriptions
          if (__DEV__) {
            console.log('MapScreen focused, location already initialized');
          }
        }
      }
      
      // Cleanup when screen loses focus
      return () => {
        if (locationHistoryIntervalRef.current) {
          clearInterval(locationHistoryIntervalRef.current);
          locationHistoryIntervalRef.current = null;
        }
        // Don't reset hasInitializedLocationRef here - keep it for the session
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUserLocation])
  );

  // Save location to history every 10 minutes while on MapScreen
  const saveLocationToHistory = React.useCallback(async (): Promise<void> => {
    if (!user?.id || !showUserLocation) return;

    try {
      // Check if enough time has passed (prevent constant updates)
      const now = Date.now();
      const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 minutes
      if (lastLocationHistorySaveRef.current > 0 && (now - lastLocationHistorySaveRef.current) < TEN_MINUTES_MS) {
        // Silently skip - don't log to reduce console spam
        return;
      }

      // Request permissions if needed
      const hasPermission = await locationService.checkPermissions();
      if (!hasPermission) {
        const permissionResult = await locationService.requestPermissions();
        if (!permissionResult.granted) {
          console.warn('Location permission not granted, cannot save to history');
          return;
        }
      }

      // Get current location with high accuracy
      const currentLocation = await locationService.getHighAccuracyLocation(true);
      if (!currentLocation || !currentLocation.latitude || !currentLocation.longitude) {
        console.warn('Could not get location for history save');
        return;
      }

      // Get accuracy from location if available
      let locationAccuracy: number | null = null;
      try {
        const locationWithAccuracy = await ExpoLocation.getCurrentPositionAsync({
          accuracy: Platform.OS === 'ios' ? ExpoLocation.Accuracy.BestForNavigation : ExpoLocation.Accuracy.Highest,
          maximumAge: 5000, // Allow 5 second old data
          timeout: 10000,
        });
        locationAccuracy = locationWithAccuracy?.coords?.accuracy !== undefined && locationWithAccuracy?.coords?.accuracy !== null
          ? locationWithAccuracy.coords.accuracy
          : null;
      } catch (accuracyError) {
        // Accuracy is optional, continue without it
        if (__DEV__) {
          console.warn('Could not get location accuracy:', accuracyError);
        }
      }

      // Get address - try to get it if not already available
      // Since we're only saving once per 10 minutes, we can try harder to get the address
      let addressToSave = currentLocation.address;
      if (!addressToSave) {
        try {
          // Try to get address from geocoding (force: true since we only do this once per 10 minutes)
          addressToSave = await locationService.getAddressFromCoordinates(
            currentLocation.latitude,
            currentLocation.longitude,
            true // Force geocoding since we only save once per 10 minutes
          );
          if (__DEV__ && addressToSave) {
            console.log('Address geocoded for location history:', addressToSave);
          }
        } catch (geocodeError) {
          // Address is optional, continue without it
          if (__DEV__) {
            console.warn('Could not geocode address for location history:', geocodeError);
          }
        }
      }

      // Insert into location_history table
      const { error } = await supabase
        .from('location_history')
        .insert({
          user_id: user.id,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: addressToSave || null,
          accuracy: locationAccuracy,
        });

      if (error) {
        console.error('Error saving location to history:', error);
      } else {
        lastLocationHistorySaveRef.current = Date.now();
        if (__DEV__) {
          console.log('✅ Location saved to history from MapScreen:', {
            lat: currentLocation.latitude.toFixed(6),
            lng: currentLocation.longitude.toFixed(6),
            hasAddress: !!addressToSave,
            address: addressToSave || 'No address',
            accuracy: locationAccuracy,
          });
        }
      }
    } catch (error) {
      console.error('Error in saveLocationToHistory:', error);
    }
  }, [user?.id, showUserLocation]);

  // Set up 10-minute interval for location history updates while on MapScreen
  useEffect(() => {
    if (!user?.id || !showUserLocation) {
      // Clear interval if conditions not met
      if (locationHistoryIntervalRef.current) {
        clearInterval(locationHistoryIntervalRef.current);
        locationHistoryIntervalRef.current = null;
      }
      return;
    }

    // Prevent setting up multiple intervals
    if (locationHistoryIntervalRef.current) {
      if (__DEV__) {
        console.log('Location history interval already set up, skipping...');
      }
      return;
    }

    // Save location immediately when screen is focused (only if enough time has passed)
    const now = Date.now();
    const TEN_MINUTES_MS = 10 * 60 * 1000; // 10 minutes
    if (lastLocationHistorySaveRef.current === 0 || (now - lastLocationHistorySaveRef.current) >= TEN_MINUTES_MS) {
      // Call after a small delay to ensure everything is initialized
      setTimeout(() => {
        saveLocationToHistory();
      }, 1000);
    }

    // Set up interval to save location every 10 minutes (600000 ms)
    locationHistoryIntervalRef.current = setInterval(() => {
      saveLocationToHistory();
    }, 600000); // 10 minutes

    if (__DEV__) {
      console.log('✅ Location history interval set up (10 minutes)');
    }

    // Cleanup on unmount or when conditions change
    return () => {
      if (locationHistoryIntervalRef.current) {
        clearInterval(locationHistoryIntervalRef.current);
        locationHistoryIntervalRef.current = null;
        if (__DEV__) {
          console.log('Location history interval cleared');
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, showUserLocation]);

  // Cleanup location watch and real-time subscriptions on unmount
  useEffect(() => {
    return () => {
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
        locationWatchSubscriptionRef.current = null;
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      if (connectionsRealtimeChannelRef.current) {
        supabase.removeChannel(connectionsRealtimeChannelRef.current);
        connectionsRealtimeChannelRef.current = null;
      }
      if (locationHistoryIntervalRef.current) {
        clearInterval(locationHistoryIntervalRef.current);
        locationHistoryIntervalRef.current = null;
      }
      // Reset initialization flags on unmount
      hasInitializedLocationRef.current = false;
      hasInitializedSubscriptionsRef.current = false;
      isFetchingLocationRef.current = false;
    };
  }, []);

  const fetchLocationHistory = async (date: Date) => {
    if (!targetUserId) {
      if (__DEV__) {
        console.warn('Cannot fetch location history: targetUserId is not set');
      }
      setLocationHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    try {
      if (__DEV__) {
        console.log('Fetching location history for user:', targetUserId, 'date:', date.toISOString());
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      const now = new Date();
      const hoursSinceStartOfDay = Math.ceil((now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
      const hoursToFetch = Math.max(hoursSinceStartOfDay, 168);

      const allHistory = await locationService.getLocationHistory(targetUserId, hoursToFetch);
      
      if (__DEV__) {
        console.log(`Found ${allHistory.length} total location history entries for user ${targetUserId}`);
      }

      // Check if any location_history exists at all (not just for selected date)
      // This is important when viewing another user
      if (userId && userId !== user?.id) {
        // Check if location_history exists for this user
        const lastLocation = await locationService.getLastLocationFromHistory(targetUserId);
        if (!lastLocation || !lastLocation.latitude || !lastLocation.longitude) {
          setHasLocationHistory(false);
          setLocationHistory([]);
          setHistoryLoading(false);
          // Also clear destination location since there's no valid location
          setDestinationLocation({ latitude: 0, longitude: 0 });
          if (__DEV__) {
            console.log('No location_history found for connected user');
          }
          return;
        } else {
          setHasLocationHistory(true);
          // Update destination location with the last location from history
          setDestinationLocation(lastLocation);
        }
      }

      let filteredHistory = allHistory.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= startOfDay && itemDate <= endOfDay;
      });

      if (__DEV__) {
        console.log(`Filtered to ${filteredHistory.length} entries for selected date`);
      }

      filteredHistory.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const entriesWithoutAddress = filteredHistory.filter(item => !item.address);
      if (entriesWithoutAddress.length > 0) {
        Promise.all(
          entriesWithoutAddress.slice(0, 10).map(async (item) => {
            try {
              const address = await locationService.reverseGeocode(
                item.latitude,
                item.longitude
              );
              if (address) {
                const index = filteredHistory.findIndex(
                  h => h.latitude === item.latitude && 
                       h.longitude === item.longitude && 
                       h.timestamp === item.timestamp
                );
                if (index !== -1) {
                  filteredHistory[index].address = address;
                  setLocationHistory([...filteredHistory]);
                }
              }
            } catch (error) {
              // Silently fail
            }
          })
        ).catch(() => {});
      }

      setLocationHistory(filteredHistory);
      
      if (__DEV__) {
        if (filteredHistory.length === 0) {
          console.log('No location history found for selected date. Total entries fetched:', allHistory.length);
        } else {
          console.log(`✅ Location history loaded: ${filteredHistory.length} entries`);
        }
      }
    } catch (error) {
      console.error('Error fetching location history:', error);
      setLocationHistory([]);
      // If viewing another user and error occurs, assume no location_history
      if (userId && userId !== user?.id) {
        setHasLocationHistory(false);
        setDestinationLocation({ latitude: 0, longitude: 0 });
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      if (__DEV__) {
        console.log('Loading location history for targetUserId:', targetUserId);
      }
      // Check if viewing another user - if so, check location_history first
      if (userId && userId !== user?.id) {
        // Check for location_history before fetching
        locationService.getLastLocationFromHistory(targetUserId).then((lastLocation) => {
          if (!lastLocation || !lastLocation.latitude || !lastLocation.longitude) {
            setHasLocationHistory(false);
            setDestinationLocation({ latitude: 0, longitude: 0 });
            setLocationHistory([]);
            setHistoryLoading(false);
            setLoading(false); // Set main loading to false
            if (__DEV__) {
              console.log('No location_history found for connected user on initial load');
            }
          } else {
            setHasLocationHistory(true);
            setDestinationLocation(lastLocation);
            fetchLocationHistory(selectedDate);
          }
        }).catch((error) => {
          console.error('Error checking location_history:', error);
          setHasLocationHistory(false);
          setDestinationLocation({ latitude: 0, longitude: 0 });
          setLocationHistory([]);
          setHistoryLoading(false);
          setLoading(false); // Set main loading to false
        });
      } else {
        // Viewing own location or no userId specified
        setHasLocationHistory(true);
        fetchLocationHistory(selectedDate);
      }
      pendingUpdatesRef.current = [];
      setPendingUpdatesCount(0);
    } else {
      if (__DEV__) {
        console.warn('targetUserId is not set, cannot fetch location history');
      }
      setLocationHistory([]);
      setHasLocationHistory(true); // Default to true if no targetUserId
    }
  }, [targetUserId, selectedDate, userId, user?.id]);

  // Real-time subscription for location_history (for timeline)
  useEffect(() => {
    if (!targetUserId) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`location_history_${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_history',
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          const newEntry = payload.new;
          if (newEntry && newEntry.created_at) {
            const entryDate = new Date(newEntry.created_at);
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            if (entryDate >= startOfDay && entryDate <= endOfDay) {
              const newLocation: Location & { timestamp: string } = {
                latitude: newEntry.latitude,
                longitude: newEntry.longitude,
                address: newEntry.address || undefined,
                timestamp: newEntry.created_at,
              };

              if (autoRefreshEnabled) {
                setLocationHistory((prev) => [newLocation, ...prev]);
              } else {
                pendingUpdatesRef.current.push(newLocation);
                setPendingUpdatesCount(pendingUpdatesRef.current.length);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'location_history',
          filter: `user_id=eq.${targetUserId}`,
        },
        (payload) => {
          if (autoRefreshEnabled && payload.old && payload.old.id) {
            setLocationHistory((prev) => 
              prev.filter((item) => {
                const oldEntry = payload.old;
                return !(
                  item.latitude === oldEntry.latitude &&
                  item.longitude === oldEntry.longitude &&
                  item.timestamp === oldEntry.created_at
                );
              })
            );
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [targetUserId, selectedDate, autoRefreshEnabled]);

  // Real-time subscription for connections table to get live location updates
  // This watches for location updates from the connected user (works in both foreground and background)
  useEffect(() => {
    if (!targetUserId || !user?.id || targetUserId === user.id) {
      // Clean up if conditions not met
      if (connectionsRealtimeChannelRef.current) {
        supabase.removeChannel(connectionsRealtimeChannelRef.current);
        connectionsRealtimeChannelRef.current = null;
        hasInitializedSubscriptionsRef.current = false;
      }
      return;
    }

    // Prevent duplicate subscriptions
    if (hasInitializedSubscriptionsRef.current && connectionsRealtimeChannelRef.current) {
      if (__DEV__) {
        console.log('Connections subscription already initialized, skipping...');
      }
      return;
    }

    // Clean up existing subscription
    if (connectionsRealtimeChannelRef.current) {
      supabase.removeChannel(connectionsRealtimeChannelRef.current);
      connectionsRealtimeChannelRef.current = null;
    }

    // Subscribe to connections table updates for the target user's location
    // This watches where connected_user_id = targetUserId (location updates from the connected user)
    const connectionsChannel = supabase
      .channel(`map_connections_${targetUserId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
          filter: `connected_user_id=eq.${targetUserId}`,
        },
        (payload) => {
          const updatedConnection = payload.new;
          if (updatedConnection && 
              updatedConnection.location_latitude && 
              updatedConnection.location_longitude) {
            
            const newLocation: Location = {
              latitude: updatedConnection.location_latitude,
              longitude: updatedConnection.location_longitude,
              address: updatedConnection.location_address || undefined,
            };

            // Check if user has moved significantly (more than 20 meters) to avoid unnecessary updates
            const MIN_DISTANCE_THRESHOLD = 20; // 20 meters
            const lastLocation = lastDestinationLocationRef.current;
            
            if (lastLocation) {
              const distance = calculateDistance(
                lastLocation.latitude,
                lastLocation.longitude,
                newLocation.latitude,
                newLocation.longitude
              );

              // Only update if user has moved significantly
              if (distance < MIN_DISTANCE_THRESHOLD) {
                // User hasn't moved significantly, skip update and logging
                return;
              }
            }

            // Update destination location in real-time
            setDestinationLocation(newLocation);
            lastDestinationLocationRef.current = newLocation;

            if (__DEV__) {
              const distanceMoved = lastLocation 
                ? calculateDistance(
                    lastLocation.latitude,
                    lastLocation.longitude,
                    newLocation.latitude,
                    newLocation.longitude
                  ).toFixed(1)
                : 'initial';
              console.log('Live location updated for connected user:', {
                userId: targetUserId,
                lat: newLocation.latitude.toFixed(6),
                lng: newLocation.longitude.toFixed(6),
                address: newLocation.address || 'no address',
                distanceMoved: `${distanceMoved}m`,
                timestamp: updatedConnection.location_updated_at,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          hasInitializedSubscriptionsRef.current = true;
          console.log(`✅ Subscribed to live location updates for user: ${targetUserId}`);
        } else if (status === 'CHANNEL_ERROR') {
          hasInitializedSubscriptionsRef.current = false;
          console.error('❌ Error subscribing to connections real-time updates');
        }
      });

    connectionsRealtimeChannelRef.current = connectionsChannel;

    // Also fetch initial location from connections table
    const fetchInitialConnectionLocation = async () => {
      try {
        const { data: connectionData } = await supabase
          .from('connections')
          .select('location_latitude, location_longitude, location_address, location_updated_at')
          .eq('user_id', user.id)
          .eq('connected_user_id', targetUserId)
          .eq('status', 'connected')
          .single();

        if (connectionData && 
            connectionData.location_latitude && 
            connectionData.location_longitude) {
          const initialLocation: Location = {
            latitude: connectionData.location_latitude,
            longitude: connectionData.location_longitude,
            address: connectionData.location_address || undefined,
          };
          setDestinationLocation(initialLocation);
          lastDestinationLocationRef.current = initialLocation; // Initialize last location
          
          if (__DEV__) {
            console.log('Initial connection location fetched:', {
              lat: initialLocation.latitude.toFixed(6),
              lng: initialLocation.longitude.toFixed(6),
            });
          }
        }
      } catch (error) {
        console.warn('Error fetching initial connection location:', error);
      }
    };

    fetchInitialConnectionLocation();

      return () => {
        if (connectionsRealtimeChannelRef.current) {
          supabase.removeChannel(connectionsRealtimeChannelRef.current);
          connectionsRealtimeChannelRef.current = null;
          hasInitializedSubscriptionsRef.current = false;
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId, user?.id]);

  const handleManualRefresh = React.useCallback(async () => {
    if (!targetUserId) return;

    setIsRefreshing(true);
    try {
      const pending = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      setPendingUpdatesCount(0);
      await fetchLocationHistory(selectedDate);

      if (pending.length > 0) {
        setLocationHistory((prev) => {
          const existingTimestamps = new Set(prev.map(item => item.timestamp));
          const newItems = pending.filter(item => !existingTimestamps.has(item.timestamp));
          return [...newItems, ...prev].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      }
    } catch (error) {
      console.error('Error refreshing location history:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [targetUserId, selectedDate]);

  useFocusEffect(
    React.useCallback(() => {
      if (targetUserId && autoRefreshEnabled) {
        fetchLocationHistory(selectedDate);
      }
    }, [targetUserId, selectedDate, autoRefreshEnabled])
  );

  const polylineCoordinates = useMemo(() => {
    const coordinates = locationHistory.length > 0
      ? [...locationHistory].reverse().map((loc) => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
        }))
      : [];
    
    if (showUserLocation && userLocation) {
      if (coordinates.length > 0) {
        const lastPoint = coordinates[coordinates.length - 1];
        const distance = Math.sqrt(
          Math.pow(userLocation.latitude - lastPoint.latitude, 2) +
          Math.pow(userLocation.longitude - lastPoint.longitude, 2)
        );
        if (distance > 0.0001) {
          coordinates.push({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          });
        }
      } else {
        coordinates.push({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }
    }
    return coordinates;
  }, [locationHistory, userLocation, showUserLocation]);

  const historyMarkers = useMemo(() => {
    return locationHistory.map((item, index) => {
      const isSelected = selectedHistoryItem === index;
      const markerKey = `${item.latitude.toFixed(6)}-${item.longitude.toFixed(6)}-${item.timestamp}`;
      
      return (
        <Marker
          key={markerKey}
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          centerOffset={{ x: 0, y: 0 }}
          tracksViewChanges={false}
          flat={false}
          zIndex={isSelected ? 100 : 50}
          onPress={() => {
            setSelectedHistoryItem(index);
            focusOnLocation(item.latitude, item.longitude);
          }}
        >
          <View 
            style={[
              styles.historyMarkerContainer,
              isSelected && styles.historyMarkerSelected
            ]}
            pointerEvents="none"
          >
            <View style={styles.historyMarkerDot} />
          </View>
        </Marker>
      );
    });
  }, [locationHistory, selectedHistoryItem, focusOnLocation]);

  const timelineStats = useMemo(
    () => ({
      pointCount: locationHistory.length,
      lastUpdated: locationHistory[0]?.timestamp ?? null,
    }),
    [locationHistory]
  );

  const formatDistanceLabel = (meters: number): string => {
    if (meters < 1) return '< 1 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const cycleMapLayer = (): void => {
    setMapLayer((current) => {
      const index = MAP_LAYER_CYCLE.indexOf(current);
      return MAP_LAYER_CYCLE[(index + 1) % MAP_LAYER_CYCLE.length];
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };


  const calculateTimeDiff = (timestamp1: string, timestamp2: string): number => {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return Math.abs(date2.getTime() - date1.getTime()) / 1000;
  };

  const formatDateDisplay = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const formatTimeRange = (startTime: string, endTime: string): string => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).toLowerCase();
    };
    return `${formatTime(start)} – ${formatTime(end)}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const focusOnLocation = React.useCallback((lat: number, lng: number) => {
    animateMapToRegion(
      {
        latitude: lat,
        longitude: lng,
        latitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
        longitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
      },
      500
    );
  }, [animateMapToRegion]);

  const centerMarkerInVisibleArea = React.useCallback(() => {
    const hasDest =
      hasLocationHistory &&
      destinationLocation.latitude !== 0 &&
      destinationLocation.longitude !== 0;
    const lat = hasDest ? destinationLocation.latitude : userLocation?.latitude;
    const lng = hasDest ? destinationLocation.longitude : userLocation?.longitude;

    if (lat && lng) {
      focusOnLocation(lat, lng);
    }
  }, [hasLocationHistory, destinationLocation, userLocation, focusOnLocation]);

  const handleRefreshLocation = async (): Promise<void> => {
    try {
      setIsLocating(true);
      // Request permission if needed (foreground and background)
      const permissionResult = await locationService.requestPermissions();
      if (!permissionResult.granted) {
        console.warn('Location permission not granted:', permissionResult.message);
        setIsLocating(false);
        return;
      }

      // Request background permissions if not already requested
      if (!hasRequestedBackgroundPermissionRef.current) {
        try {
          const { status: backgroundStatus } = await ExpoLocation.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('Background location permission granted');
          }
          hasRequestedBackgroundPermissionRef.current = true;
        } catch (bgError) {
          console.warn('Background permission request failed:', bgError);
        }
      }
      
      // Get the actual current location with high accuracy (works in both foreground and background)
      const exactLocation = await locationService.getHighAccuracyLocation(true);
      
      if (exactLocation) {
        setUserLocation(exactLocation);

        animateMapToRegion(
          {
            latitude: exactLocation.latitude,
            longitude: exactLocation.longitude,
            latitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
            longitudeDelta: Platform.OS === 'ios' ? 0.0006 : 0.001,
          },
          1000
        );

        if (__DEV__) {
          console.log('Location updated via button:', {
            lat: exactLocation.latitude.toFixed(6),
            lng: exactLocation.longitude.toFixed(6),
            platform: Platform.OS,
          });
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setIsLocating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#EEF2FF', '#F8FAFC', '#FFFFFF']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title || t('map.locationMap')}
            </Text>
            <Text style={styles.headerSubtitle}>{t('map.loadingLocationData')}</Text>
          </View>
          <View style={styles.headerIconButtonPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingTitle}>{t('map.preparingMap')}</Text>
            <Text style={styles.loadingSubtitle}>{t('map.fetchingLocationHistory')}</Text>
          </View>
        </View>
      </View>
    );
  }

  const hasValidDestination =
    hasLocationHistory &&
    destinationLocation &&
    destinationLocation.latitude !== 0 &&
    destinationLocation.longitude !== 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialMapRegionRef.current}
        mapPadding={mapPadding}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        mapType={mapLayer}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        pitchEnabled={mapLayer !== 'satellite'}
        moveOnMarkerPress={false}
        onMapReady={() => {
          setMapError(null);
          if (!hasCenteredWithPaddingRef.current) {
            hasCenteredWithPaddingRef.current = true;
            setTimeout(() => {
              centerMarkerInVisibleArea();
            }, 350);
          }
        }}
        onError={(error) => {
          const errorMessage = error?.nativeEvent?.message || 'Map failed to load';
          setMapError(errorMessage);
        }}
        onRegionChangeComplete={(region) => {
          if (region) {
            mapRegionRef.current = region;
          }
        }}
      >
        {polylineCoordinates.length > 1 && (
          <Polyline
            coordinates={polylineCoordinates}
            strokeColor="#6366F1"
            strokeWidth={4}
            lineDashPattern={Platform.OS === 'ios' ? undefined : [1]}
          />
        )}

        {hasValidDestination && (
          <Circle
            center={{
              latitude: destinationLocation.latitude,
              longitude: destinationLocation.longitude,
            }}
            radius={120}
            fillColor="rgba(239, 68, 68, 0.12)"
            strokeColor="rgba(239, 68, 68, 0.35)"
            strokeWidth={1.5}
          />
        )}

        {historyMarkers}

        {hasValidDestination && (
          <Marker
            key="destination-marker"
            coordinate={destinationLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            centerOffset={{ x: 0, y: 0 }}
            tracksViewChanges={false}
            zIndex={999}
            onPress={() => {
              focusOnLocation(destinationLocation.latitude, destinationLocation.longitude);
            }}
          >
            <View style={styles.destinationPinWrap} pointerEvents="none" collapsable={false}>
              <View style={styles.destinationPinPulse} />
              <View style={styles.destinationPinHead} collapsable={false}>
                <Ionicons name="location" size={20} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}

        {showUserLocation && userLocation && (
          <Marker
            key="user-marker"
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            centerOffset={{ x: 0, y: 0 }}
            tracksViewChanges={false}
            zIndex={998}
            onPress={() => {
              focusOnLocation(userLocation.latitude, userLocation.longitude);
            }}
          >
            <View style={styles.userPinWrap} pointerEvents="none" collapsable={false}>
              <View style={styles.userPinHead}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      <LinearGradient
        colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.08)', 'transparent']}
        style={[styles.topScrim, { height: insets.top + 120 }]}
        pointerEvents="none"
      />

      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || t('map.locationMap')}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {timelineStats.lastUpdated
              ? t('map.updatedAt', { time: formatTime(timelineStats.lastUpdated) })
              : hasValidDestination
                ? t('map.liveLocationTracking')
                : t('map.locationTimeline')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleManualRefresh}
          disabled={isRefreshing || loading}
          activeOpacity={0.75}
        >
          {isRefreshing || loading ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Ionicons name="refresh" size={20} color="#6366F1" />
          )}
          {pendingUpdatesCount > 0 && !autoRefreshEnabled && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingUpdatesCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {hasValidDestination && (
        <View
          style={[
            styles.locationInfoCard,
            { bottom: showTimelinePanel ? BOTTOM_SHEET_HEIGHT + 16 : insets.bottom + 16 },
          ]}
        >
          <View style={styles.locationInfoIcon}>
            <Ionicons name="navigate" size={18} color="#6366F1" />
          </View>
          <View style={styles.locationInfoCopy}>
            <Text style={styles.locationInfoTitle} numberOfLines={1}>
              {destinationLocation.address?.split(',')[0] || t('map.currentLocation')}
            </Text>
            <Text style={styles.locationInfoMeta} numberOfLines={1}>
              {destinationLocation.address ||
                `${destinationLocation.latitude.toFixed(5)}, ${destinationLocation.longitude.toFixed(5)}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.locationInfoAction}
            onPress={() => centerMarkerInVisibleArea()}
            activeOpacity={0.8}
          >
            <Ionicons name="scan-outline" size={18} color="#6366F1" />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.mapControls,
          { bottom: showTimelinePanel ? BOTTOM_SHEET_HEIGHT + 20 : insets.bottom + 20 },
        ]}
      >
        <TouchableOpacity style={styles.controlButton} onPress={cycleMapLayer} activeOpacity={0.85}>
          <Ionicons name="layers-outline" size={20} color="#334155" />
          <Text style={styles.controlButtonLabel}>{mapLayerLabels[mapLayer]}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.controlButtonPrimary]}
          onPress={handleRefreshLocation}
          disabled={isLocating}
          activeOpacity={0.85}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="locate" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {hasOfflineMap && (
        <View style={[styles.offlineBadge, { top: insets.top + 72 }]}>
          <Ionicons name="cloud-offline-outline" size={14} color="#10B981" />
          <Text style={styles.offlineBadgeText}>{t('map.offlineMapAvailable')}</Text>
        </View>
      )}

      {mapError && (
        <View style={styles.mapErrorContainer}>
          <View style={styles.mapErrorIconWrap}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
          </View>
          <Text style={styles.mapErrorText}>{t('map.mapFailedToLoad')}</Text>
          <Text style={styles.mapErrorSubtext}>
            {Platform.OS === 'android'
              ? 'Check Google Play Services and your internet connection.'
              : 'Check your internet connection and try again.'}
          </Text>
        </View>
      )}

      {userId && userId !== user?.id && !hasLocationHistory && !historyLoading && (
        <View style={styles.mapErrorContainer}>
          <View style={[styles.mapErrorIconWrap, styles.mapErrorIconWrapMuted]}>
            <Ionicons name="location-off-outline" size={24} color="#64748B" />
          </View>
          <Text style={styles.mapErrorText}>{t('map.locationUnavailable')}</Text>
          <Text style={styles.mapErrorSubtext}>
            {t('map.locationNotShared', { name: title || t('map.thisUser') })}
          </Text>
        </View>
      )}

      {showTimelinePanel && (
        <View style={[styles.bottomSheet, { height: BOTTOM_SHEET_HEIGHT, paddingBottom: insets.bottom }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('map.locationTimelineTitle')}</Text>
              <Text style={styles.sheetSubtitle}>
                {t('map.pointsRecorded', { count: timelineStats.pointCount })}
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>{t('common.live')}</Text>
            </View>
          </View>

          <View style={styles.dateCard}>
            <TouchableOpacity
              style={styles.dateNavButton}
              onPress={() => navigateDate('prev')}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={18} color="#6366F1" />
            </TouchableOpacity>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
              <Text style={styles.dateSubtext}>
                {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dateNavButton}
              onPress={() => navigateDate('next')}
              disabled={selectedDate.toDateString() === new Date().toDateString()}
              activeOpacity={0.75}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={selectedDate.toDateString() === new Date().toDateString() ? '#CBD5E1' : '#6366F1'}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.timelineContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.timelineContent}
          >
            {historyLoading ? (
              <View style={styles.timelineLoading}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.timelineLoadingText}>{t('common.loading')}</Text>
              </View>
            ) : locationHistory.length === 0 ? (
              <View style={styles.timelineEmpty}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="location-outline" size={40} color="#C7D2FE" />
                </View>
                <Text style={styles.timelineEmptyTitle}>{t('map.noLocationHistory')}</Text>
                <Text style={styles.timelineEmptyText}>
                  {t('map.noLocationDataForDate', { date: formatDateDisplay(selectedDate).toLowerCase() })}
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {locationHistory.map((item, index) => {
                  const isFirst = index === 0;
                  const isLast = index === locationHistory.length - 1;
                  const prevItem = index > 0 ? locationHistory[index - 1] : null;

                  const distance = prevItem
                    ? calculateDistance(
                        prevItem.latitude,
                        prevItem.longitude,
                        item.latitude,
                        item.longitude
                      )
                    : 0;

                  const timeDiff = prevItem
                    ? calculateTimeDiff(prevItem.timestamp, item.timestamp)
                    : 0;

                  const isActivity = Boolean(prevItem && distance > 10);
                  const isSelected = selectedHistoryItem === index;

                  return (
                    <TouchableOpacity
                      key={`${item.timestamp}-${index}`}
                      style={[styles.timelineCard, isSelected && styles.timelineCardSelected]}
                      onPress={() => {
                        setSelectedHistoryItem(index);
                        focusOnLocation(item.latitude, item.longitude);
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.timelineCardContent}>
                        <View style={styles.timelineLeft}>
                          <View
                            style={[
                              styles.timelineDot,
                              isActivity && styles.timelineDotActivity,
                              isSelected && styles.timelineDotSelected,
                            ]}
                          >
                            {isActivity ? (
                              <Ionicons name="walk" size={12} color="#FFFFFF" />
                            ) : (
                              <View style={styles.timelineDotInner} />
                            )}
                          </View>
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.timelineRight}>
                          {isActivity && prevItem ? (
                            <>
                              <View style={styles.timelineHeader}>
                                <View style={styles.activityBadge}>
                                  <Ionicons name="walk" size={13} color="#10B981" />
                                  <Text style={styles.activityBadgeText}>{t('map.movement')}</Text>
                                </View>
                                <Text style={styles.timelineTime}>
                                  {formatTimeRange(prevItem.timestamp, item.timestamp)}
                                </Text>
                              </View>
                              <View style={styles.activityStats}>
                                <View style={styles.statItem}>
                                  <Ionicons name="resize-outline" size={14} color="#64748B" />
                                  <Text style={styles.statText}>{formatDistanceLabel(distance)}</Text>
                                </View>
                                <View style={styles.statItem}>
                                  <Ionicons name="time-outline" size={14} color="#64748B" />
                                  <Text style={styles.statText}>{formatDuration(timeDiff)}</Text>
                                </View>
                              </View>
                            </>
                          ) : (
                            <>
                              <View style={styles.timelineHeader}>
                                <Text style={styles.timelineTitle} numberOfLines={1}>
                                  {item.address ? item.address.split(',')[0] : t('map.locationPoint')}
                                </Text>
                                <Text style={styles.timelineTime}>
                                  {new Date(item.timestamp).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  }).toLowerCase()}
                                </Text>
                              </View>
                              {item.address ? (
                                <Text style={styles.timelineAddress} numberOfLines={2}>
                                  {item.address}
                                </Text>
                              ) : null}
                              <View style={styles.timelineFooter}>
                                <Text style={styles.timelineStatus}>
                                  {isFirst ? t('map.latestPosition') : t('map.previousStop')}
                                </Text>
                                <Text style={styles.timelineDate}>{formatTime(item.timestamp)}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
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
  headerIconButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  headerCopy: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  locationInfoCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  locationInfoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfoCopy: {
    flex: 1,
  },
  locationInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  locationInfoMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  locationInfoAction: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    gap: 10,
    alignItems: 'flex-end',
  },
  controlButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 2,
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
  controlButtonPrimary: {
    backgroundColor: '#6366F1',
    minWidth: 52,
    minHeight: 52,
    borderRadius: 18,
  },
  controlButtonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  destinationPinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  destinationPinPulse: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  destinationPinHead: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  userPinWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  userPinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  historyMarkerContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyMarkerSelected: {
    width: 26,
    height: 26,
  },
  historyMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  offlineBadge: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  offlineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  mapErrorContainer: {
    position: 'absolute',
    top: '36%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    zIndex: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  mapErrorIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapErrorIconWrapMuted: {
    backgroundColor: '#F1F5F9',
  },
  mapErrorText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  mapErrorSubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  dateNavButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  timelineContainer: {
    flex: 1,
  },
  timelineContent: {
    paddingBottom: 12,
  },
  timelineLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  timelineLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  timelineEmpty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  timelineEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  timelineEmptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  timelineList: {
    gap: 10,
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    overflow: 'hidden',
  },
  timelineCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#F8FAFF',
  },
  timelineCardContent: {
    flexDirection: 'row',
    padding: 14,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  timelineDotActivity: {
    backgroundColor: '#10B981',
  },
  timelineDotSelected: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  timelineDotInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  timelineLine: {
    position: 'absolute',
    left: 10,
    top: 22,
    width: 2,
    backgroundColor: '#E2E8F0',
    bottom: -10,
  },
  timelineRight: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  timelineAddress: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 8,
  },
  timelineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timelineStatus: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '700',
  },
  timelineDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  activityBadgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  activityStats: {
    flexDirection: 'row',
    gap: 14,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
