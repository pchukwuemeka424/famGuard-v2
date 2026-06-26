import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useIncidents } from '../context/IncidentContext';
import type { RootStackParamList } from '../types';

type IncidentDetailScreenRouteProp = RouteProp<RootStackParamList, 'IncidentDetail'>;
type IncidentDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'IncidentDetail'>;

interface IncidentDetailScreenProps {
  route: IncidentDetailScreenRouteProp;
  navigation: IncidentDetailScreenNavigationProp;
}

const SCREEN_BG = '#E8EEF6';

export default function IncidentDetailScreen({ route, navigation }: IncidentDetailScreenProps) {
  const { incident } = route.params;
  const { upvoteIncident, userLocation, calculateDistance } = useIncidents();
  const insets = useSafeAreaInsets();
  const accentColor = getCategoryColor(incident.category);

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    incident.location.latitude,
    incident.location.longitude
  );

  const handleDirections = (): void => {
    navigation.navigate('MapView', {
      location: incident.location,
      title: incident.title,
      showUserLocation: true,
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.75}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBody}>
            <View style={styles.heroTopRow}>
              <View style={[styles.categoryPill, { backgroundColor: accentColor + '18' }]}>
                <Ionicons name={getCategoryIcon(incident.category)} size={14} color={accentColor} />
                <Text style={[styles.categoryPillText, { color: accentColor }]}>{incident.category}</Text>
              </View>
              {incident.confirmed ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroTitle}>{incident.title}</Text>
            <Text style={styles.heroDescription}>{incident.description}</Text>
          </View>
        </View>

        {incident.imageUrl ? (
          <View style={styles.imageCard}>
            <Text style={styles.cardLabel}>Photo</Text>
            <Image source={{ uri: incident.imageUrl }} style={styles.incidentImage} resizeMode="cover" />
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.cardLabel}>Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="time-outline" size={18} color="#2563EB" />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Reported</Text>
                <Text style={styles.infoValue}>{getTimeAgo(incident.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="navigate-outline" size={18} color="#F97316" />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Distance</Text>
                <Text style={styles.infoValue}>{distance.toFixed(1)} km away</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.infoIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="person-outline" size={18} color="#22C55E" />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Reporter</Text>
                <Text style={styles.infoValue}>
                  {incident.reporter.isAnonymous ? 'Anonymous' : incident.reporter.name}
                </Text>
              </View>
            </View>

            {incident.location.address ? (
              <View style={styles.infoItem}>
                <View style={[styles.infoIconWrap, { backgroundColor: '#F8FAFC' }]}>
                  <Ionicons name="location-outline" size={18} color="#64748B" />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{incident.location.address}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.mapCard}>
          <Text style={styles.cardLabel}>Map</Text>
          <View style={styles.mapContainer}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: incident.location.latitude,
                longitude: incident.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={incident.location} title={incident.title}>
                <View style={[styles.incidentMarker, { backgroundColor: accentColor }]}>
                  <Ionicons name={getCategoryIcon(incident.category)} size={18} color="#FFFFFF" />
                </View>
              </Marker>
              <Marker coordinate={userLocation} title="You">
                <View style={styles.userMarker}>
                  <Ionicons name="person" size={14} color="#FFFFFF" />
                </View>
              </Marker>
            </MapView>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.upvoteButton} onPress={() => upvoteIncident(incident.id)} activeOpacity={0.85}>
            <Ionicons name="arrow-up" size={20} color="#2563EB" />
            <Text style={styles.upvoteText}>{incident.upvotes} upvotes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.directionsButton} onPress={handleDirections} activeOpacity={0.85}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.directionsButtonText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now.getTime() - time.getTime()) / 1000 / 60);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function getCategoryIcon(category: string): keyof typeof Ionicons.glyphMap {
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
}

function getCategoryColor(category: string): string {
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: SCREEN_BG,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  scroll: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
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
  heroBody: {
    flex: 1,
    padding: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  imageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  incidentImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  infoGrid: {
    gap: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    lineHeight: 20,
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  incidentMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  upvoteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  upvoteText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '700',
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  directionsButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
