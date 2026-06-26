import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useIncidents } from '../context/IncidentContext';
import { useAppSetting } from '../context/AppSettingContext';
import { locationService } from '../services/locationService';
import { incidentProximityService } from '../services/incidentProximityService';
import { supabase } from '../lib/supabase';
import SafetyFeedHeader from '../components/SafetyFeedHeader';
import type { MainTabParamList, RootStackParamList, Incident } from '../types';

type IncidentFeedScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Incidents'>,
  StackNavigationProp<RootStackParamList>
>;

interface IncidentFeedScreenProps {
  navigation: IncidentFeedScreenNavigationProp;
}

type ViewMode = 'list' | 'map';
type SortMode = 'newest' | 'nearest' | 'upvotes';

const DEFAULT_TIME_FILTER = '1hr';
const DEFAULT_DISTANCE_KM = 5;
const LIST_BACKGROUND = '#E8EEF6';

export default function IncidentFeedScreen({ navigation }: IncidentFeedScreenProps) {
  const insets = useSafeAreaInsets();
  const { incidents, fetchNearbyIncidents, userLocation, setUserLocation, calculateDistance, loading, refreshIncidents } =
    useIncidents();
  const { hideReportIncident } = useAppSetting();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [locationFetched, setLocationFetched] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [refreshing, setRefreshing] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const hasPermission = await locationService.checkPermissions();
        if (hasPermission) {
          const location = await locationService.getCurrentLocation(false);
          if (location) {
            setUserLocation(location);
          }
        }
      } catch (error) {
        console.error('Error loading user location:', error);
      } finally {
        setLocationFetched(true);
      }
    };

    loadUserLocation();
  }, [setUserLocation]);

  useEffect(() => {
    if (locationFetched && userLocation.latitude && userLocation.longitude) {
      fetchNearbyIncidents(DEFAULT_TIME_FILTER, DEFAULT_DISTANCE_KM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation.latitude, userLocation.longitude, locationFetched]);

  useEffect(() => {
    incidentProximityService.startPeriodicChecking();
    return () => {
      incidentProximityService.stopPeriodicChecking();
    };
  }, []);

  useEffect(() => {
    if (!locationFetched) return;

    const channelName = `incident_feed_${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        async (payload) => {
          if (locationFetched && userLocation.latitude && userLocation.longitude) {
            fetchNearbyIncidents(DEFAULT_TIME_FILTER, DEFAULT_DISTANCE_KM);
          }

          if (payload.eventType === 'INSERT' && payload.new) {
            incidentProximityService.triggerCheck().catch((error) => {
              console.error('Error triggering incident proximity check:', error);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFetched, userLocation.latitude, userLocation.longitude]);

  const filteredIncidents = useMemo(() => {
    let result = [...incidents];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.location.address?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortMode === 'nearest') {
        const distA = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          a.location.latitude,
          a.location.longitude
        );
        const distB = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          b.location.latitude,
          b.location.longitude
        );
        return distA - distB;
      }
      if (sortMode === 'upvotes') {
        return b.upvotes - a.upvotes;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [incidents, searchQuery, sortMode, userLocation, calculateDistance]);

  const verifiedCount = useMemo(
    () => filteredIncidents.filter((i) => i.confirmed).length,
    [filteredIncidents]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshIncidents();
      if (userLocation.latitude && userLocation.longitude) {
        await fetchNearbyIncidents(DEFAULT_TIME_FILTER, DEFAULT_DISTANCE_KM);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshIncidents, fetchNearbyIncidents, userLocation]);

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = Math.floor((now.getTime() - time.getTime()) / 1000 / 60);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      Robbery: 'shield-outline',
      Kidnapping: 'warning-outline',
      Accident: 'car-outline',
      Fire: 'flame-outline',
      Protest: 'people-outline',
      Assault: 'hand-left-outline',
      Theft: 'bag-outline',
      Other: 'alert-circle-outline',
    };
    return icons[category] || 'alert-circle-outline';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Robbery: '#EF4444',
      Kidnapping: '#F97316',
      Accident: '#EAB308',
      Fire: '#DC2626',
      Protest: '#3B82F6',
      Assault: '#EF4444',
      Theft: '#64748B',
      Other: '#94A3B8',
    };
    return colors[category] || '#94A3B8';
  };

  const sortLabels: Record<SortMode, string> = {
    newest: 'Newest',
    nearest: 'Nearest',
    upvotes: 'Most upvoted',
  };

  const renderIncidentCard = ({ item }: { item: Incident }) => {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      item.location.latitude,
      item.location.longitude
    );
    const accentColor = getCategoryColor(item.category);

    return (
      <TouchableOpacity
        style={styles.incidentCard}
        onPress={() => navigation.navigate('IncidentDetail', { incident: item })}
        activeOpacity={0.85}
      >
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={[styles.categoryPill, { backgroundColor: accentColor + '18' }]}>
              <Ionicons name={getCategoryIcon(item.category)} size={13} color={accentColor} />
              <Text style={[styles.categoryPillText, { color: accentColor }]}>{item.category}</Text>
            </View>
            {item.confirmed ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>

          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : null}

          {item.location.address ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#94A3B8" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.location.address}
              </Text>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <View style={styles.metaGroup}>
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={13} color="#64748B" />
                <Text style={styles.metaText}>{getTimeAgo(item.createdAt)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="navigate-outline" size={13} color="#64748B" />
                <Text style={styles.metaText}>{distance.toFixed(1)} km</Text>
              </View>
            </View>

            <View style={styles.cardFooterRight}>
              <View style={styles.upvoteChip}>
                <Ionicons name="arrow-up" size={14} color="#64748B" />
                <Text style={styles.upvoteCount}>{item.upvotes}</Text>
              </View>
              <Text style={styles.reporterText}>
                {item.reporter.isAnonymous ? 'Anonymous' : item.reporter.name}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderViewToggle = () => (
    <View style={styles.viewToggle}>
      <TouchableOpacity
        style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
        onPress={() => setViewMode('list')}
      >
        <Ionicons name="list" size={18} color={viewMode === 'list' ? '#2563EB' : '#94A3B8'} />
        <Text style={[styles.viewButtonText, viewMode === 'list' && styles.viewButtonTextActive]}>List</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewButton, viewMode === 'map' && styles.viewButtonActive]}
        onPress={() => setViewMode('map')}
      >
        <Ionicons name="map" size={18} color={viewMode === 'map' ? '#2563EB' : '#94A3B8'} />
        <Text style={[styles.viewButtonText, viewMode === 'map' && styles.viewButtonTextActive]}>Map</Text>
      </TouchableOpacity>
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardReports]}>
          <View style={styles.statIconWrap}>
            <Ionicons name="alert-circle" size={18} color="#2563EB" />
          </View>
          <Text style={[styles.statValue, styles.statValueReports]}>{filteredIncidents.length}</Text>
          <Text style={[styles.statLabel, styles.statLabelReports]}>Reports</Text>
        </View>
        <View style={[styles.statCard, styles.statCardVerified]}>
          <View style={styles.statIconWrap}>
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
          </View>
          <Text style={[styles.statValue, styles.statValueVerified]}>{verifiedCount}</Text>
          <Text style={[styles.statLabel, styles.statLabelVerified]}>Verified</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRadius]}>
          <View style={styles.statIconWrap}>
            <Ionicons name="radio-outline" size={18} color="#EA580C" />
          </View>
          <Text style={[styles.statValue, styles.statValueRadius]}>{DEFAULT_DISTANCE_KM} km</Text>
          <Text style={[styles.statLabel, styles.statLabelRadius]}>Radius</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search reports..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        {renderViewToggle()}

        <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortMenu((v) => !v)}>
          <Ionicons name="swap-vertical" size={16} color="#64748B" />
          <Text style={styles.sortButtonText}>{sortLabels[sortMode]}</Text>
          <Ionicons name={showSortMenu ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {showSortMenu ? (
        <View style={styles.sortMenu}>
          {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.sortOption, sortMode === mode && styles.sortOptionActive]}
              onPress={() => {
                setSortMode(mode);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortMode === mode && styles.sortOptionTextActive]}>
                {sortLabels[mode]}
              </Text>
              {sortMode === mode ? <Ionicons name="checkmark" size={16} color="#2563EB" /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {filteredIncidents.length > 0 ? (
        <Text style={styles.resultsCount}>
          {filteredIncidents.length} result{filteredIncidents.length === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <SafetyFeedHeader
        paddingTop={insets.top + 8}
        incidentCount={filteredIncidents.length}
        radiusKm={DEFAULT_DISTANCE_KM}
        hideReport={hideReportIncident}
        onReportPress={() => navigation.navigate('ReportIncident')}
      />

      {viewMode === 'map' ? (
        <View style={styles.listPanel}>
          <View style={styles.mapContainer}>
            <View style={styles.mapToolbar}>
              <View style={styles.mapToolbarFooter}>
                {renderViewToggle()}
                <Text style={styles.mapCountText}>
                  {filteredIncidents.length} pin{filteredIncidents.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
            >
              <Marker coordinate={userLocation} title="You">
                <View style={styles.userMarker}>
                  <Ionicons name="person" size={14} color="#FFFFFF" />
                </View>
              </Marker>

              {filteredIncidents.map((incident) => (
                <Marker
                  key={incident.id}
                  coordinate={{
                    latitude: incident.location.latitude,
                    longitude: incident.location.longitude,
                  }}
                  title={incident.title}
                  description={incident.location.address || incident.category}
                  onPress={() => navigation.navigate('IncidentDetail', { incident })}
                >
                  <View style={[styles.incidentMarker, { backgroundColor: getCategoryColor(incident.category) }]}>
                    <Ionicons name={getCategoryIcon(incident.category)} size={14} color="#FFFFFF" />
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        </View>
      ) : (
        <View style={styles.listPanel}>
          <FlatList
            data={filteredIncidents}
            renderItem={renderIncidentCard}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 88 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" colors={['#2563EB']} />
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.emptyStateTitle}>Loading reports...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="shield-checkmark" size={40} color="#22C55E" />
                  </View>
                  <Text style={styles.emptyStateTitle}>
                    {searchQuery ? 'No matching reports' : 'All clear in your area'}
                  </Text>
                  <Text style={styles.emptyStateText}>
                    {searchQuery
                      ? 'Try adjusting your search.'
                      : 'No incidents reported nearby. Stay safe and check back for live updates.'}
                  </Text>
                  {!hideReportIncident ? (
                    <TouchableOpacity
                      style={styles.emptyAction}
                      onPress={() => navigation.navigate('ReportIncident')}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                      <Text style={styles.emptyActionText}>Report an incident</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            }
          />
        </View>
      )}

      {!hideReportIncident ? (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => navigation.navigate('ReportIncident')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  listPanel: {
    flex: 1,
    backgroundColor: LIST_BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    backgroundColor: LIST_BACKGROUND,
  },
  listHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 2,
    backgroundColor: LIST_BACKGROUND,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  statCardReports: {
    backgroundColor: '#BFDBFE',
  },
  statCardVerified: {
    backgroundColor: '#BBF7D0',
  },
  statCardRadius: {
    backgroundColor: '#FED7AA',
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statValueReports: {
    color: '#1E40AF',
  },
  statValueVerified: {
    color: '#166534',
  },
  statValueRadius: {
    color: '#9A3412',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statLabelReports: {
    color: '#2563EB',
  },
  statLabelVerified: {
    color: '#16A34A',
  },
  statLabelRadius: {
    color: '#EA580C',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 6,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 4,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  viewButtonTextActive: {
    color: '#2563EB',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  sortMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sortOptionActive: {
    backgroundColor: '#F8FAFC',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  resultsCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    flexGrow: 1,
    backgroundColor: LIST_BACKGROUND,
  },
  incidentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  cardBody: {
    flex: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F1F5F9',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upvoteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  upvoteCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  reporterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: LIST_BACKGROUND,
  },
  mapToolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  mapToolbarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  map: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  userMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  incidentMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    gap: 8,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
