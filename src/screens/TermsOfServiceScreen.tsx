import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../types';
import { useTranslation } from '../context/LanguageContext';

type TermsOfServiceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TermsOfService'>;

interface TermsOfServiceScreenProps {
  navigation: TermsOfServiceScreenNavigationProp;
}

export default function TermsOfServiceScreen({ navigation }: TermsOfServiceScreenProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('termsOfService.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('termsOfService.lastUpdated')}</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section1Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section1Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section2Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section2Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section3Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section3Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section4Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section4Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section5Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section5Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section6Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section6Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section7Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section7Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsOfService.section8Title')}</Text>
          <Text style={styles.text}>{t('termsOfService.section8Text')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 22,
  },
});

