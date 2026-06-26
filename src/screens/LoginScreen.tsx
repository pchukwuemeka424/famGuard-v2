import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import type { RootStackParamList } from '../types';

const LOGIN_FAMILY_BG = require('../../assets/home/login-family-bg.png');

const ACCENT_RED = '#DC2626';
const ACCENT_RED_DARK = '#B91C1C';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showQuickLogin, setShowQuickLogin] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotPasswordPhone, setForgotPasswordPhone] = useState<string>('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState<boolean>(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string>('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<boolean>(false);
  const { login, lastLoggedInPhone, lastLoggedInName, resetPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const handlePhoneChange = (text: string): void => {
    setPhone(text.replace(/\D/g, '').slice(0, 11));
    if (error) {
      setError('');
    }
  };

  const handleForgotPasswordPhoneChange = (text: string): void => {
    setForgotPasswordPhone(text.replace(/\D/g, '').slice(0, 11));
    setForgotPasswordError('');
  };

  useEffect(() => {
    if (lastLoggedInPhone) {
      setShowQuickLogin(true);
      setPhone(lastLoggedInPhone);
    }
  }, [lastLoggedInPhone]);

  const handleLogin = async (): Promise<void> => {
    if (!phone || !password) {
      setError(t('login.errorFillAllFields'));
      return;
    }

    if (phone.length !== 11) {
      setError(t('login.errorPhone11Digits'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(phone, password);
    } catch (err: any) {
      setError(err.message || t('login.errorLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (): Promise<void> => {
    if (!lastLoggedInPhone || !password) {
      setError(t('login.errorEnterPassword'));
      return;
    }

    setQuickLoginLoading(true);
    setError('');

    try {
      await login(lastLoggedInPhone, password);
    } catch (err: any) {
      setError(err.message || t('login.errorLoginFailed'));
    } finally {
      setQuickLoginLoading(false);
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    const phoneToUse = showQuickLogin ? lastLoggedInPhone : forgotPasswordPhone.trim();

    if (!phoneToUse) {
      setForgotPasswordError(t('login.errorEnterPhone'));
      return;
    }

    if (phoneToUse.length !== 11) {
      setForgotPasswordError(t('login.errorPhone11Digits'));
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);

    try {
      await resetPassword(phoneToUse);
      setForgotPasswordSuccess(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordPhone('');
        setForgotPasswordSuccess(false);
      }, 3000);
    } catch (err: any) {
      setForgotPasswordError(err.message || t('login.errorResetFailed'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openForgotPassword = (): void => {
    setShowForgotPassword(true);
    setForgotPasswordPhone(showQuickLogin ? lastLoggedInPhone || '' : phone);
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);
  };

  const closeForgotPassword = (): void => {
    setShowForgotPassword(false);
    setForgotPasswordPhone('');
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);
  };

  const switchAccount = (): void => {
    setShowQuickLogin(false);
    setPassword('');
    setError('');
  };

  const userInitial = lastLoggedInName
    ? lastLoggedInName.trim().charAt(0).toUpperCase()
    : lastLoggedInPhone
      ? lastLoggedInPhone.slice(-1)
      : '?';

  const isSubmitting = loading || quickLoginLoading;
  const phoneValid = phone.length === 11;

  const renderPasswordField = (autoFocus = false) => (
    <View style={styles.inputWrapper}>
      <Text style={styles.label}>{t('login.password')}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color="#0F172A" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={t('login.passwordPlaceholder')}
          placeholderTextColor="#94A3B8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color="#64748B"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderError = () =>
    error ? (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={18} color="#DC2626" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : null;

  const renderSignInButton = (onPress: () => void, isLoading: boolean) => (
    <TouchableOpacity
      style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isSubmitting}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#EF4444', ACCENT_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryButtonGradient}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <View style={styles.primaryButtonIconLeft}>
              <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.primaryButtonText}>{t('login.signIn')}</Text>
            <View style={styles.primaryButtonIconRight}>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

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
          {/* Photo banner */}
          <View style={styles.banner}>
            <Image source={LOGIN_FAMILY_BG} style={styles.bannerImage} resizeMode="cover" />

            <LinearGradient
              pointerEvents="none"
              colors={[
                'transparent',
                'rgba(15, 23, 42, 0.08)',
                'rgba(247, 249, 252, 0.55)',
                'rgba(247, 249, 252, 0.92)',
                '#F7F9FC',
              ]}
              locations={[0, 0.35, 0.65, 0.85, 1]}
              style={styles.bannerBottomShadow}
            />

            {showQuickLogin && lastLoggedInPhone ? (
              <TouchableOpacity
                style={[styles.backButton, { top: insets.top + 8 }]}
                onPress={switchAccount}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={22} color="#0F172A" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Brand */}
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{t('common.appName')}</Text>
            <Text style={styles.tagline}>{t('login.tagline')}</Text>
            <View style={styles.taglineRow}>
              <View style={styles.taglineDivider} />
              <View style={styles.taglineDot} />
            </View>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            {showQuickLogin && lastLoggedInPhone ? (
              <>
                <View style={styles.quickLoginHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{userInitial}</Text>
                  </View>
                  <View style={styles.quickLoginTextWrap}>
                    <Text style={styles.cardTitle}>{t('login.welcomeBack')}</Text>
                    <Text style={styles.cardSubtitle}>{lastLoggedInName || lastLoggedInPhone}</Text>
                  </View>
                </View>

                {renderPasswordField(true)}

                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={styles.rememberText}>{t('login.rememberMe')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openForgotPassword} activeOpacity={0.7}>
                    <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
                  </TouchableOpacity>
                </View>

                {renderError()}
                {renderSignInButton(handleQuickLogin, quickLoginLoading)}

                <TouchableOpacity style={styles.switchAccountButton} onPress={switchAccount} activeOpacity={0.7}>
                  <Ionicons name="swap-horizontal-outline" size={18} color="#0F172A" />
                  <Text style={styles.switchAccountText}>{t('login.useDifferentAccount')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{t('login.welcomeBack')}</Text>
                <Text style={styles.cardSubtitle}>{t('login.signInSubtitle')}</Text>

                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>{t('login.phoneNumber')}</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color="#0F172A" style={styles.inputIcon} />
                    <View style={styles.countryPill}>
                      <Text style={styles.countryCode}>{t('common.countryCode')}</Text>
                    </View>
                    <View style={styles.countryDivider} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.phonePlaceholder')}
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
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  {phone.length > 0 && !phoneValid ? (
                    <Text style={styles.phoneHint}>{t('login.phoneDigitsHint', { count: phone.length })}</Text>
                  ) : null}
                </View>

                {renderPasswordField()}

                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                      {rememberMe ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={styles.rememberText}>{t('login.rememberMe')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={openForgotPassword} activeOpacity={0.7}>
                    <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
                  </TouchableOpacity>
                </View>

                {renderError()}
                {renderSignInButton(handleLogin, loading)}

                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>{t('login.dontHaveAccount')}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.7}>
                    <Text style={styles.signupLink}>{t('login.signUp')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Ionicons name="shield-checkmark" size={16} color="#0F172A" />
            <Text style={styles.footerText}>{t('login.footerText')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent
        animationType="slide"
        onRequestClose={closeForgotPassword}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <TouchableOpacity style={styles.modalCloseButton} onPress={closeForgotPassword} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>

              <View style={styles.modalIconWrap}>
                <Ionicons name="key-outline" size={28} color="#0F172A" />
              </View>

              <Text style={styles.modalTitle}>{t('login.resetPassword')}</Text>
              <Text style={styles.modalSubtitle}>{t('login.resetPasswordSubtitle')}</Text>

              {!showQuickLogin ? (
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>{t('login.phoneNumber')}</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color="#0F172A" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.phonePlaceholderForgot')}
                      placeholderTextColor="#94A3B8"
                      value={forgotPasswordPhone}
                      onChangeText={handleForgotPasswordPhoneChange}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoComplete="tel"
                      autoCorrect={false}
                      maxLength={11}
                      editable={!forgotPasswordLoading && !forgotPasswordSuccess}
                    />
                  </View>
                </View>
              ) : lastLoggedInPhone ? (
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>{t('login.phoneNumber')}</Text>
                  <View style={styles.readOnlyField}>
                    <Ionicons name="call-outline" size={20} color="#0F172A" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{lastLoggedInPhone}</Text>
                  </View>
                </View>
              ) : null}

              {forgotPasswordError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{forgotPasswordError}</Text>
                </View>
              ) : null}

              {forgotPasswordSuccess ? (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={18} color="#0F172A" />
                  <Text style={styles.successText}>{t('login.resetSuccess')}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, (forgotPasswordLoading || forgotPasswordSuccess) && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={forgotPasswordLoading || forgotPasswordSuccess}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#EF4444', ACCENT_RED]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {forgotPasswordSuccess ? t('login.emailSent') : t('login.sendResetLink')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Banner
  banner: {
    width: '100%',
    height: 300,
    position: 'relative',
    backgroundColor: ACCENT_RED_DARK,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerBottomShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Brand
  brandBlock: {
    alignItems: 'center',
    marginTop: -28,
    paddingHorizontal: 24,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 6,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  taglineDivider: {
    width: 30,
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

  // Form card
  formCard: {
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    marginBottom: 22,
    lineHeight: 20,
  },
  quickLoginHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  quickLoginTextWrap: {
    flex: 1,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Inputs
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 54,
  },
  inputIcon: {
    marginRight: 8,
  },
  countryPill: {
    justifyContent: 'center',
  },
  countryCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  countryDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 6,
    marginLeft: 4,
  },
  validBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT_RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  phoneHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    marginLeft: 2,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 54,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },

  // Options row
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 18,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: ACCENT_RED,
    borderColor: ACCENT_RED,
  },
  rememberText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Primary button
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_RED_DARK,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  primaryButtonIconLeft: {
    position: 'absolute',
    left: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonIconRight: {
    position: 'absolute',
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  switchAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 8,
  },
  switchAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  signupText: {
    color: '#64748B',
    fontSize: 14,
  },
  signupLink: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },

  // Feedback
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  successText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    padding: 6,
    marginBottom: 4,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
});
