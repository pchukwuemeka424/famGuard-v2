import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import EditProfileHeader from '../components/EditProfileHeader';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types';

type EditProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EditProfile'>;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

const SCREEN_BG = '#F1F5F9';
const ACCENT = '#8B5CF6';

const getInitials = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [phone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const initials = useMemo(() => getInitials(name || user?.name || ''), [name, user?.name]);
  const hasChanges = name.trim() !== (user?.name || '').trim();

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name before saving.');
      return;
    }

    if (!hasChanges) {
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      await updateUser({ name: name.trim() });
      Alert.alert('Profile updated', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <EditProfileHeader
        paddingTop={insets.top + 8}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarCard}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <Text style={styles.avatarName}>{name.trim() || 'Your name'}</Text>
            <Text style={styles.avatarHint}>Only your name can be edited here</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Personal details</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <View style={styles.inputRow}>
                <View style={[styles.inputIconWrap, styles.inputIconWrapEditable]}>
                  <Ionicons name="person-outline" size={18} color={ACCENT} />
                </View>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldGroup}>
              <View style={styles.readonlyLabelRow}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={10} color="#64748B" />
                  <Text style={styles.lockedBadgeText}>Locked</Text>
                </View>
              </View>
              <View style={[styles.inputRow, styles.inputRowReadonly]}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="mail-outline" size={18} color="#64748B" />
                </View>
                <Text style={styles.readonlyValue}>{email || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.fieldGroup}>
              <View style={styles.readonlyLabelRow}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <View style={styles.lockedBadge}>
                  <Ionicons name="lock-closed" size={10} color="#64748B" />
                  <Text style={styles.lockedBadgeText}>Locked</Text>
                </View>
              </View>
              <View style={[styles.inputRow, styles.inputRowReadonly]}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="call-outline" size={18} color="#64748B" />
                </View>
                <Text style={styles.readonlyValue}>{phone || 'Not set'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
            </View>
            <Text style={styles.infoText}>
              Email and phone are tied to your account login and cannot be changed here. Contact
              support if you need to update them.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.saveButton, (loading || !name.trim()) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading || !name.trim()}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {hasChanges ? 'Save changes' : 'Done'}
                </Text>
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
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  avatarCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.5,
  },
  avatarName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  avatarHint: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  readonlyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    minHeight: 52,
  },
  inputRowReadonly: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  inputIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  inputIconWrapEditable: {
    backgroundColor: '#EDE9FE',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#0F172A',
    paddingVertical: 12,
  },
  readonlyValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  infoIconWrap: {
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: '#5B21B6',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: SCREEN_BG,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
