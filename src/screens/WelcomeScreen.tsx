import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import type { RootStackParamList } from '../types';

const WELCOME_HERO = require('../../assets/home/welcome-home.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const heroSource = Image.resolveAssetSource(WELCOME_HERO);
const heroAspectRatio =
  heroSource.width > 0 ? heroSource.height / heroSource.width : 0.8;
const HERO_HEIGHT = Math.min(SCREEN_WIDTH * heroAspectRatio, SCREEN_HEIGHT * 0.42);

const ACCENT_RED = '#DC2626';
const ACCENT_RED_DARK = '#B91C1C';
const ACCENT_RED_LIGHT = '#EF4444';
const TEXT_DARK = '#0F172A';
const TEXT_DARK_MUTED = '#475569';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.heroSection, { height: HERO_HEIGHT }]}>
        <Image source={WELCOME_HERO} style={styles.heroImage} resizeMode="contain" />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <LanguageSwitcher compact />
          <Text style={styles.appName}>{t('common.appName')}</Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.description}>{t('welcome.description')}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Signup')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[ACCENT_RED_LIGHT, ACCENT_RED, ACCENT_RED_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>{t('welcome.getStarted')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginRow}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={18} color={TEXT_DARK} />
            <Text style={styles.loginText}>
              {t('welcome.alreadyHaveAccount')}{' '}
              <Text style={styles.loginLink}>{t('welcome.login')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => navigation.navigate('UserManual')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={18} color={TEXT_DARK} />
            <Text style={styles.manualButtonText}>{t('welcome.userManual')}</Text>
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <Ionicons name="lock-closed-outline" size={14} color={TEXT_DARK} style={styles.legalIcon} />
            <Text style={styles.legalText}>
              {t('welcome.legalPrefix')}{' '}
              <Text
                style={styles.legalLink}
                onPress={() => navigation.navigate('TermsOfService')}
              >
                {t('welcome.termsOfService')}
              </Text>
              {t('welcome.legalAnd')}
              <Text
                style={styles.legalLink}
                onPress={() => navigation.navigate('PrivacyPolicy')}
              >
                {t('welcome.privacyPolicy')}
              </Text>
            </Text>
          </View>

          <View style={styles.footer}>
            <Ionicons name="shield-outline" size={16} color={TEXT_DARK} />
            <Text style={styles.footerText}>{t('common.companyName')}</Text>
          </View>
        </ScrollView>
      </Animated.View>

      <View style={styles.cornerDecorLeft} pointerEvents="none" />
      <View style={styles.cornerDecorRight} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  heroSection: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 4,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 16,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '72%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FEE2E2',
  },
  dividerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_RED_LIGHT,
    marginHorizontal: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_DARK_MUTED,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_RED_DARK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 4,
  },
  loginText: {
    fontSize: 15,
    color: TEXT_DARK_MUTED,
  },
  loginLink: {
    color: TEXT_DARK,
    fontWeight: '700',
  },
  manualButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  manualButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  legalIcon: {
    marginTop: 2,
    marginRight: 6,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_DARK_MUTED,
    textAlign: 'center',
  },
  legalLink: {
    color: TEXT_DARK,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_DARK_MUTED,
    letterSpacing: 0.2,
  },
  cornerDecorLeft: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    opacity: 0.5,
  },
  cornerDecorRight: {
    position: 'absolute',
    bottom: 20,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    opacity: 0.35,
  },
});
