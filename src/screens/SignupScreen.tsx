import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { searchLgas, searchStates } from '../data/nigeriaLocations';
import type { RootStackParamList } from '../types';

const SIGNUP_HEADER = require('../../assets/home/signup.png');

const ACCENT_RED = '#DC2626';
const ACCENT_RED_DARK = '#B91C1C';
const H_PADDING = 20;

type PickerType = 'state' | 'lga' | null;

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface SignupScreenProps {
  navigation: SignupScreenNavigationProp;
}

export default function SignupScreen({ navigation }: SignupScreenProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedLga, setSelectedLga] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();

  const phoneValid = phone.length === 11;
  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const filteredStates = useMemo(() => searchStates(pickerSearch), [pickerSearch]);
  const filteredLgas = useMemo(
    () => searchLgas(selectedState, pickerSearch),
    [selectedState, pickerSearch],
  );

  const clearError = (): void => {
    if (error) setError('');
  };

  const openPicker = (type: PickerType): void => {
    setPickerSearch('');
    setActivePicker(type);
  };

  const closePicker = (): void => {
    setActivePicker(null);
    setPickerSearch('');
  };

  const handlePhoneChange = (text: string): void => {
    setPhone(text.replace(/\D/g, '').slice(0, 11));
    clearError();
  };

  const handleStateSelect = (stateName: string): void => {
    setSelectedState(stateName);
    setSelectedLga('');
    closePicker();
    clearError();
  };

  const handleLgaSelect = (lgaName: string): void => {
    setSelectedLga(lgaName);
    closePicker();
    clearError();
  };

  const handleSignup = async (): Promise<void> => {
    if (!name.trim() || !email.trim() || !phone || !password || !confirmPassword) {
      setError(t('signup.errorFillRequired'));
      return;
    }

    if (!selectedState) {
      setError(t('signup.errorSelectState'));
      return;
    }

    if (!selectedLga) {
      setError(t('signup.errorSelectLga'));
      return;
    }

    if (phone.length !== 11) {
      setError(t('signup.errorPhone11Digits'));
      return;
    }

    if (password.length < 6) {
      setError(t('signup.errorPasswordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('signup.errorPasswordsNoMatch'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signup(name.trim(), email.trim(), phone, password, selectedState, selectedLga);
    } catch (err: any) {
      setError(err.message || t('signup.errorSignupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const renderError = () =>
    error ? (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={16} color="#DC2626" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : null;

  const renderField = (
    value: string,
    onChangeText: (text: string) => void,
    options: {
      icon: keyof typeof Ionicons.glyphMap;
      placeholder: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'words' | 'sentences';
      autoComplete?: 'email' | 'tel' | 'name' | 'off';
      maxLength?: number;
      secure?: boolean;
      visible?: boolean;
      onToggleSecure?: () => void;
      hint?: string;
      trailing?: React.ReactNode;
    },
  ) => (
    <View style={styles.fieldWrap}>
      <View style={styles.field}>
        <Ionicons name={options.icon} size={18} color="#64748B" />
        <TextInput
          style={styles.fieldInput}
          placeholder={options.placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            clearError();
          }}
          keyboardType={options.keyboardType ?? 'default'}
          autoCapitalize={options.autoCapitalize ?? 'none'}
          autoComplete={options.autoComplete}
          autoCorrect={false}
          maxLength={options.maxLength}
          secureTextEntry={options.secure && !options.visible}
        />
        {options.onToggleSecure ? (
          <TouchableOpacity onPress={options.onToggleSecure} hitSlop={8} activeOpacity={0.7}>
            <Ionicons
              name={options.visible ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color="#94A3B8"
            />
          </TouchableOpacity>
        ) : null}
        {options.trailing}
      </View>
      {options.hint ? <Text style={styles.fieldHint}>{options.hint}</Text> : null}
    </View>
  );

  const renderSelectField = (
    value: string,
    placeholder: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    compact = false,
  ) => (
    <TouchableOpacity
      style={[styles.field, compact && styles.fieldCompact]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color="#64748B" />
      <Text
        style={[styles.selectText, !value && styles.selectPlaceholder]}
        numberOfLines={1}
      >
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
    </TouchableOpacity>
  );

  const pickerTitle =
    activePicker === 'state' ? t('signup.selectState') : t('signup.selectLga');

  const pickerOptions = activePicker === 'state' ? filteredStates : filteredLgas;

  const selectedPickerValue = activePicker === 'state' ? selectedState : selectedLga;

  const handlePickerSelect = (option: string): void => {
    if (activePicker === 'state') {
      handleStateSelect(option);
      return;
    }
    handleLgaSelect(option);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LanguageSwitcher compact />
          <View style={styles.banner}>
            <Image source={SIGNUP_HEADER} style={styles.bannerImage} resizeMode="cover" />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'transparent',
                'rgba(15, 23, 42, 0.06)',
                'rgba(247, 249, 252, 0.7)',
                '#F7F9FC',
              ]}
              locations={[0, 0.4, 0.75, 1]}
              style={styles.bannerFade}
            />
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 8 }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{t('common.appName')}</Text>
            <Text style={styles.tagline}>{t('signup.tagline')}</Text>
            <View style={styles.taglineAccent}>
              <View style={styles.taglineLine} />
              <View style={styles.taglineDot} />
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>{t('signup.createAccount')}</Text>
            <Text style={styles.cardSubtitle}>{t('signup.createAccountSubtitle')}</Text>

            {renderField(name, setName, {
              icon: 'person-outline',
              placeholder: t('signup.fullNamePlaceholder'),
              autoCapitalize: 'words',
              autoComplete: 'name',
            })}

            {renderField(email, setEmail, {
              icon: 'mail-outline',
              placeholder: t('signup.emailPlaceholder'),
              keyboardType: 'email-address',
              autoComplete: 'email',
            })}

            <View style={styles.fieldWrap}>
              <View style={styles.field}>
                <Ionicons name="call-outline" size={18} color="#64748B" />
                <Text style={styles.phonePrefix}>{t('common.countryCode')}</Text>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={t('signup.phonePlaceholder')}
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                  autoCorrect={false}
                  maxLength={11}
                />
                {phoneValid ? (
                  <View style={styles.validBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              {phone.length > 0 && !phoneValid ? (
                <Text style={styles.fieldHint}>{t('login.phoneDigitsHint', { count: phone.length })}</Text>
              ) : null}
            </View>

            <View style={styles.locationRow}>
              <View style={styles.locationCol}>
                {renderSelectField(selectedState, t('signup.statePlaceholder'), 'map-outline', () => openPicker('state'), true)}
              </View>
              {selectedState ? (
                <View style={styles.locationCol}>
                  {renderSelectField(
                    selectedLga,
                    t('signup.lgaPlaceholder'),
                    'business-outline',
                    () => openPicker('lga'),
                    true,
                  )}
                </View>
              ) : null}
            </View>

            {renderField(password, setPassword, {
              icon: 'lock-closed-outline',
              placeholder: t('signup.passwordPlaceholder'),
              secure: true,
              visible: showPassword,
              onToggleSecure: () => setShowPassword(!showPassword),
              hint:
                password.length > 0 && !passwordValid
                  ? t('signup.passwordMinHint')
                  : undefined,
            })}

            {renderField(confirmPassword, setConfirmPassword, {
              icon: 'lock-closed-outline',
              placeholder: t('signup.confirmPasswordPlaceholder'),
              secure: true,
              visible: showConfirmPassword,
              onToggleSecure: () => setShowConfirmPassword(!showConfirmPassword),
              hint:
                confirmPassword.length > 0 && !passwordsMatch
                  ? t('signup.passwordsNoMatch')
                  : undefined,
            })}

            <View style={styles.trustRow}>
              <Ionicons name="shield-checkmark" size={15} color={ACCENT_RED} />
              <Text style={styles.trustText}>{t('signup.trustText')}</Text>
            </View>

            {renderError()}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#EF4444', ACCENT_RED]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <View style={styles.btnIconLeft}>
                      <Ionicons name="shield-checkmark" size={15} color="#FFFFFF" />
                    </View>
                    <Text style={styles.primaryButtonText}>{t('signup.createAccountButton')}</Text>
                    <View style={styles.btnIconRight}>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>{t('signup.alreadyHaveAccount')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.loginLink}>{t('signup.signIn')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerRow}>
            <Ionicons name="shield-checkmark" size={14} color="#64748B" />
            <Text style={styles.footerText}>{t('signup.footerText')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={closePicker}>
        <Pressable style={styles.pickerOverlay} onPress={closePicker}>
          <Pressable style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={closePicker} hitSlop={8} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearch}>
              <Ionicons name="search-outline" size={17} color="#94A3B8" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder={activePicker === 'state' ? t('signup.searchStates') : t('signup.searchLgas')}
                placeholderTextColor="#94A3B8"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCorrect={false}
                autoCapitalize="words"
              />
              {pickerSearch.length > 0 ? (
                <TouchableOpacity onPress={() => setPickerSearch('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedPickerValue === item;
                return (
                  <TouchableOpacity
                    style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                    onPress={() => handlePickerSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerOptionText, isSelected && styles.pickerOptionTextActive]}>
                      {item}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={ACCENT_RED} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>{t('signup.noResultsFound')}</Text>
                </View>
              }
            />

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  banner: {
    width: '100%',
    height: 240,
    backgroundColor: ACCENT_RED_DARK,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFade: {
    ...StyleSheet.absoluteFillObject,
  },
  backButton: {
    position: 'absolute',
    left: H_PADDING,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },

  brandBlock: {
    alignItems: 'center',
    marginTop: -24,
    paddingHorizontal: H_PADDING,
  },
  brandName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
  },
  taglineAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
  },
  taglineLine: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT_RED,
  },
  taglineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F87171',
  },

  formCard: {
    marginHorizontal: H_PADDING,
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },

  fieldWrap: {
    marginBottom: 10,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  fieldCompact: {
    paddingHorizontal: 10,
    gap: 6,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
    minWidth: 0,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    minWidth: 0,
  },
  selectPlaceholder: {
    color: '#94A3B8',
  },
  phonePrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  validBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    marginLeft: 4,
  },

  locationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  locationCol: {
    flex: 1,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    fontWeight: '500',
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },

  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_RED_DARK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 50,
  },
  btnIconLeft: {
    position: 'absolute',
    left: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnIconRight: {
    position: 'absolute',
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.65,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  loginText: {
    color: '#64748B',
    fontSize: 13,
  },
  loginLink: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: H_PADDING,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '80%',
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    paddingVertical: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PADDING,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  pickerList: {
    maxHeight: 340,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PADDING,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionActive: {
    backgroundColor: '#FEF2F2',
  },
  pickerOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    paddingRight: 12,
  },
  pickerOptionTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  pickerEmpty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
