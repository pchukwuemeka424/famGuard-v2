import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useIncidents } from '../context/IncidentContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { locationService } from '../services/locationService';
import {
  pickIncidentImageFromLibrary,
  takeIncidentPhoto,
  type IncidentImageSelection,
} from '../services/incidentImageService';
import { incidentCategories } from '../data/mockData';
import type { RootStackParamList, Location } from '../types';

type ReportIncidentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReportIncident'>;

interface ReportIncidentScreenProps {
  navigation: ReportIncidentScreenNavigationProp;
}

const SCREEN_BG = '#E8EEF6';

const CATEGORY_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  Robbery: { icon: 'shield-outline', color: '#EF4444', bg: '#FEE2E2' },
  Kidnapping: { icon: 'warning-outline', color: '#F97316', bg: '#FFEDD5' },
  Accident: { icon: 'car-outline', color: '#EAB308', bg: '#FEF9C3' },
  Fire: { icon: 'flame-outline', color: '#DC2626', bg: '#FEE2E2' },
  Protest: { icon: 'people-outline', color: '#3B82F6', bg: '#DBEAFE' },
  Assault: { icon: 'hand-left-outline', color: '#EF4444', bg: '#FEE2E2' },
  Theft: { icon: 'bag-outline', color: '#64748B', bg: '#E2E8F0' },
  Other: { icon: 'alert-circle-outline', color: '#94A3B8', bg: '#F1F5F9' },
};

export default function ReportIncidentScreen({ navigation }: ReportIncidentScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addIncident } = useIncidents();
  const { user } = useAuth();
  const [type, setType] = useState<string>('');
  const [showTypePicker, setShowTypePicker] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [isHappeningNow, setIsHappeningNow] = useState<boolean>(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageMimeType, setSelectedImageMimeType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAutoFilledType, setLastAutoFilledType] = useState<string>('');
  const [lastAutoFilledTitle, setLastAutoFilledTitle] = useState<string>('');
  const [lastAutoFilledDescription, setLastAutoFilledDescription] = useState<string>('');

  const getCategoryLabel = (category: string): string => {
    const key = `common.incidentCategories.${category.toLowerCase()}`;
    const translated = t(key);
    return translated !== key ? translated : category;
  };

  useEffect(() => {
    loadCurrentLocation();
  }, []);

  useEffect(() => {
    if (type && currentLocation) {
      autoFillIncidentDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, currentLocation]);

  const autoFillIncidentDetails = (): void => {
    if (!type || !currentLocation) return;

    const fullAddress = currentLocation.address || 'this location';
    const titles: Record<string, string> = {
      Robbery: `${type} Reported`,
      Kidnapping: 'Suspicious Activity Reported',
      Accident: 'Traffic Accident Reported',
      Fire: `${type} Reported`,
      Protest: 'Protest Gathering Reported',
      Assault: `${type} Incident Reported`,
      Theft: `${type} Reported`,
      Other: 'Incident Reported',
    };
    const descriptions: Record<string, string> = {
      Robbery: `A ${type.toLowerCase()} incident has been reported.\n\nLocation: ${fullAddress}\n\nPlease exercise caution and avoid the area if possible.`,
      Kidnapping: `Suspicious activity related to ${type.toLowerCase()} has been reported.\n\nLocation: ${fullAddress}\n\nPlease remain vigilant and report any suspicious behavior.`,
      Accident: `A traffic accident has been reported.\n\nLocation: ${fullAddress}\n\nEmergency services may be responding. Please use alternate routes if possible.`,
      Fire: `A ${type.toLowerCase()} has been reported.\n\nLocation: ${fullAddress}\n\nPlease avoid the area and follow instructions from emergency personnel.`,
      Protest: `A protest gathering has been reported.\n\nLocation: ${fullAddress}\n\nPlease expect traffic delays and exercise caution.`,
      Assault: `An ${type.toLowerCase()} incident has been reported.\n\nLocation: ${fullAddress}\n\nPlease avoid the area and report relevant information to authorities.`,
      Theft: `A ${type.toLowerCase()} has been reported.\n\nLocation: ${fullAddress}\n\nPlease secure your belongings and report suspicious activity.`,
      Other: `An incident has been reported.\n\nLocation: ${fullAddress}\n\nPlease exercise caution in the area.`,
    };

    const newTitle = titles[type] || 'Incident Reported';
    const newDescription = descriptions[type] || `An incident has been reported.\n\nLocation: ${fullAddress}`;
    const typeChanged = lastAutoFilledType !== type && lastAutoFilledType !== '';
    const shouldUpdateTitle = !title.trim() || (typeChanged && title.trim() === lastAutoFilledTitle);
    const shouldUpdateDescription =
      !description.trim() || (typeChanged && description.trim() === lastAutoFilledDescription);

    if (shouldUpdateTitle) {
      setTitle(newTitle);
      setLastAutoFilledTitle(newTitle);
    }
    if (shouldUpdateDescription) {
      setDescription(newDescription);
      setLastAutoFilledDescription(newDescription);
    }
    if (lastAutoFilledType === '' || typeChanged) {
      setLastAutoFilledType(type);
    }
  };

  const loadCurrentLocation = async (): Promise<void> => {
    try {
      setLocationLoading(true);
      setLocationError(null);

      const hasPermission = await locationService.checkPermissions();
      if (!hasPermission) {
        const permissionResult = await locationService.requestPermissions();
        if (!permissionResult.granted) {
          setLocationError(permissionResult.message || 'Location permission denied.');
          return;
        }
      }

      const location = await locationService.getHighAccuracyLocation();
      if (location) {
        setCurrentLocation(location);
      } else {
        setLocationError('Unable to get your location. Please try again.');
      }
    } catch (error: any) {
      setLocationError(error.message || 'Failed to get location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const applySelectedImage = (selection: IncidentImageSelection | null): void => {
    if (!selection) return;
    setSelectedImageUri(selection.uri);
    setSelectedImageMimeType(selection.mimeType || null);
  };

  const clearSelectedImage = (): void => {
    setSelectedImageUri(null);
    setSelectedImageMimeType(null);
  };

  const handlePickImage = (): void => {
    Alert.alert(t('reportIncident.alertAddPhotoTitle'), t('reportIncident.alertAddPhotoMessage'), [
      {
        text: t('reportIncident.alertTakePhoto'),
        onPress: async () => {
          try {
            const selection = await takeIncidentPhoto();
            applySelectedImage(selection);
          } catch (error: any) {
            Alert.alert(t('common.photo'), error.message || t('reportIncident.alertCameraFailed'));
          }
        },
      },
      {
        text: t('reportIncident.alertChooseFromLibrary'),
        onPress: async () => {
          try {
            const selection = await pickIncidentImageFromLibrary();
            applySelectedImage(selection);
          } catch (error: any) {
            Alert.alert(t('common.photo'), error.message || t('reportIncident.alertPhotosFailed'));
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!type) {
      Alert.alert(t('common.error'), t('reportIncident.alertMissingType'));
      return;
    }

    if (!title.trim() || !description.trim()) {
      Alert.alert(t('common.error'), t('reportIncident.alertMissingDetails'));
      return;
    }

    if (!currentLocation) {
      Alert.alert(t('common.error'), t('reportIncident.alertLocationRequired'));
      return;
    }

    try {
      setSubmitting(true);
      await addIncident(
        {
          type,
          title: title.trim(),
          description: description.trim(),
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: currentLocation.address || undefined,
          },
          reporter: {
            name: isAnonymous ? t('common.anonymous') : user?.name || t('common.unknown'),
            isAnonymous,
          },
          category: type,
        },
        selectedImageUri,
        selectedImageMimeType
      );

      Alert.alert(t('reportIncident.alertReportSubmittedTitle'), t('reportIncident.alertReportSubmitted'), [
        { text: t('common.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('reportIncident.alertSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.75}>
          <Ionicons name="close" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.topBarCopy}>
          <Text style={styles.topBarTitle}>{t('reportIncident.title')}</Text>
          <Text style={styles.topBarSubtitle}>{t('reportIncident.subtitle')}</Text>
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 84 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('reportIncident.incidentType')}</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowTypePicker((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownLeft}>
                {type ? (
                  <>
                    <View
                      style={[
                        styles.dropdownIconWrap,
                        { backgroundColor: (CATEGORY_CONFIG[type] || CATEGORY_CONFIG.Other).bg },
                      ]}
                    >
                      <Ionicons
                        name={(CATEGORY_CONFIG[type] || CATEGORY_CONFIG.Other).icon}
                        size={16}
                        color={(CATEGORY_CONFIG[type] || CATEGORY_CONFIG.Other).color}
                      />
                    </View>
                    <Text style={styles.dropdownValue}>{getCategoryLabel(type)}</Text>
                  </>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>{t('reportIncident.selectType')}</Text>
                )}
              </View>
              <Ionicons name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
            </TouchableOpacity>

            {showTypePicker ? (
              <View style={styles.dropdownMenu}>
                {incidentCategories.map((category, index) => {
                  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Other;
                  const active = type === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.dropdownOption,
                        index === incidentCategories.length - 1 && styles.dropdownOptionLast,
                        active && styles.dropdownOptionActive,
                      ]}
                      onPress={() => {
                        setType(category);
                        setShowTypePicker(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.dropdownOptionLeft}>
                        <View style={[styles.dropdownIconWrap, { backgroundColor: config.bg }]}>
                          <Ionicons name={config.icon} size={16} color={config.color} />
                        </View>
                        <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                          {getCategoryLabel(category)}
                        </Text>
                      </View>
                      {active ? <Ionicons name="checkmark" size={18} color="#2563EB" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('common.details')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('reportIncident.titlePlaceholder')}
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
            <TextInput
              style={[styles.input, styles.textArea, styles.inputSpacing]}
              placeholder={t('reportIncident.descriptionPlaceholder')}
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardLabel, styles.cardLabelInline]}>{t('common.photo')}</Text>
              <Text style={styles.optionalTag}>{t('common.optional')}</Text>
            </View>

            {selectedImageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: selectedImageUri }} style={styles.imagePreview} resizeMode="cover" />
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.imageActionButton} onPress={handlePickImage}>
                    <Ionicons name="swap-horizontal" size={16} color="#2563EB" />
                    <Text style={styles.imageActionText}>{t('common.replace')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.imageActionButton, styles.imageRemoveButton]}
                    onPress={clearSelectedImage}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={[styles.imageActionText, styles.imageRemoveText]}>{t('common.remove')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.uploadRow}>
                <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage} activeOpacity={0.85}>
                  <View style={styles.uploadIconWrap}>
                    <Ionicons name="camera-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.uploadCopy}>
                    <Text style={styles.uploadTitle}>{t('reportIncident.addPhoto')}</Text>
                    <Text style={styles.uploadSubtitle}>{t('reportIncident.addPhotoSubtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardLabel, styles.cardLabelInline]}>{t('common.location')}</Text>
              <TouchableOpacity onPress={loadCurrentLocation} disabled={locationLoading} style={styles.refreshChip}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={14} color="#2563EB" />
                    <Text style={styles.refreshChipText}>{t('common.refresh')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {locationLoading ? (
              <View style={styles.locationState}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.locationStateText}>{t('reportIncident.gettingLocation')}</Text>
              </View>
            ) : locationError ? (
              <View style={[styles.locationState, styles.locationErrorState]}>
                <Ionicons name="warning-outline" size={18} color="#EF4444" />
                <Text style={styles.locationErrorText}>{locationError}</Text>
              </View>
            ) : currentLocation ? (
              <View style={styles.locationSuccess}>
                <View style={styles.locationIconWrap}>
                  <Ionicons name="location" size={18} color="#2563EB" />
                </View>
                <View style={styles.locationCopy}>
                  <Text style={styles.locationAddress}>
                    {currentLocation.address || t('reportIncident.currentGpsCaptured')}
                  </Text>
                  <Text style={styles.locationCoords}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.locationHint}>{t('reportIncident.locationHint')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('reportIncident.whenDidThisHappen')}</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentButton, isHappeningNow && styles.segmentButtonActive]}
                onPress={() => setIsHappeningNow(true)}
              >
                <Ionicons name="flash-outline" size={16} color={isHappeningNow ? '#2563EB' : '#64748B'} />
                <Text style={[styles.segmentText, isHappeningNow && styles.segmentTextActive]}>{t('reportIncident.happeningNow')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentButton, !isHappeningNow && styles.segmentButtonActive]}
                onPress={() => setIsHappeningNow(false)}
              >
                <Ionicons name="time-outline" size={16} color={!isHappeningNow ? '#2563EB' : '#64748B'} />
                <Text style={[styles.segmentText, !isHappeningNow && styles.segmentTextActive]}>{t('reportIncident.earlier')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>{t('reportIncident.reportAnonymously')}</Text>
                <Text style={styles.toggleSubtitle}>{t('reportIncident.reportAnonymouslySubtitle')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, isAnonymous && styles.toggleActive]}
                onPress={() => setIsAnonymous(!isAnonymous)}
                activeOpacity={0.85}
              >
                <View style={[styles.toggleThumb, isAnonymous && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={18} color="#2563EB" />
            <Text style={styles.noticeText}>
              {t('reportIncident.falseReportsNotice')}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>{t('reportIncident.submitReport')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: SCREEN_BG,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarCopy: {
    flex: 1,
    marginLeft: 10,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  topBarSpacer: {
    width: 36,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  dropdownIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dropdownValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  cardLabelInline: {
    marginBottom: 0,
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
    fontSize: 14,
    color: '#0F172A',
  },
  inputSpacing: {
    marginTop: 8,
  },
  textArea: {
    minHeight: 96,
    paddingTop: 11,
  },
  charCount: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 2,
  },
  uploadRow: {
    flexDirection: 'row',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  uploadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCopy: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  imagePreviewWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  imagePreview: {
    width: '100%',
    height: 160,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
  },
  imageActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 8,
    gap: 4,
  },
  imageRemoveButton: {
    backgroundColor: '#FEF2F2',
  },
  imageActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  imageRemoveText: {
    color: '#EF4444',
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  refreshChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  locationState: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  locationStateText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  locationErrorState: {
    backgroundColor: '#FEF2F2',
  },
  locationErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  locationSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationCopy: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
  },
  locationCoords: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  locationHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 15,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#2563EB',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    padding: 3,
  },
  toggleActive: {
    backgroundColor: '#2563EB',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 4,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 16,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: SCREEN_BG,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
