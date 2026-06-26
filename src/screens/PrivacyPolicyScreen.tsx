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

type PrivacyPolicyScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PrivacyPolicy'>;

interface PrivacyPolicyScreenProps {
  navigation: PrivacyPolicyScreenNavigationProp;
}

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyScreenProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('privacyPolicy.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>{t('privacyPolicy.lastUpdated')}</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section1Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section1Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section2Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section2Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section3Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section3Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section4Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section4Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section5Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section5Text')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacyPolicy.section6Title')}</Text>
          <Text style={styles.text}>{t('privacyPolicy.section6Text')}</Text>
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
    padding: 16,
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

