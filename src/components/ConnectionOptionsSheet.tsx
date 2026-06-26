import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Connection } from '../types';

type SheetStep = 'menu' | 'confirm-lock' | 'confirm-unlock' | 'confirm-remove';

interface ConnectionOptionsSheetProps {
  visible: boolean;
  connection: Connection | null;
  submitting?: boolean;
  onClose: () => void;
  onLock: (connection: Connection) => Promise<void>;
  onUnlock: (connection: Connection) => Promise<void>;
  onRemove: (connection: Connection) => Promise<void>;
}

export default function ConnectionOptionsSheet({
  visible,
  connection,
  submitting = false,
  onClose,
  onLock,
  onUnlock,
  onRemove,
}: ConnectionOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SheetStep>('menu');

  useEffect(() => {
    if (!visible) {
      setStep('menu');
    }
  }, [visible]);

  if (!connection) {
    return null;
  }

  const displayName = connection.connectedUserName || 'Unknown User';
  const initial = displayName.charAt(0).toUpperCase();

  const handleClose = (): void => {
    if (submitting) return;
    onClose();
  };

  const handleBack = (): void => {
    if (submitting) return;
    setStep('menu');
  };

  const handleConfirm = async (): Promise<void> => {
    if (submitting) return;

    if (step === 'confirm-lock') {
      await onLock(connection);
    } else if (step === 'confirm-unlock') {
      await onUnlock(connection);
    } else if (step === 'confirm-remove') {
      await onRemove(connection);
    }
  };

  const renderMenu = () => (
    <>
      <View style={styles.profileRow}>
        <View style={[styles.avatar, connection.isLocked && styles.avatarEmergency]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileHint}>Manage this connection</Text>
        </View>
      </View>

      <View style={styles.actionGroup}>
        {connection.isLocked ? (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setStep('confirm-unlock')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, styles.actionIconWrapSuccess]}>
              <Ionicons name="lock-open-outline" size={20} color="#059669" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Unlock Account</Text>
              <Text style={styles.actionSubtitle}>Restore their app access</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setStep('confirm-lock')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconWrap, styles.actionIconWrapWarning]}>
              <Ionicons name="lock-closed-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Lock Account</Text>
              <Text style={styles.actionSubtitle}>Restrict their app access</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setStep('confirm-remove')}
          activeOpacity={0.75}
        >
          <View style={[styles.actionIconWrap, styles.actionIconWrapDanger]}>
            <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={[styles.actionTitle, styles.actionTitleDanger]}>Remove Connection</Text>
            <Text style={styles.actionSubtitle}>Stop sharing with this person</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.85}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </>
  );

  const renderConfirm = () => {
    const config =
      step === 'confirm-lock'
        ? {
            icon: 'lock-closed' as const,
            iconColor: '#D97706',
            iconBg: '#FEF3C7',
            title: 'Lock account?',
            message: `This will restrict ${displayName}'s access to the app until you unlock them.`,
            confirmLabel: 'Lock Account',
            confirmStyle: styles.confirmButtonWarning,
          }
        : step === 'confirm-unlock'
          ? {
              icon: 'lock-open' as const,
              iconColor: '#059669',
              iconBg: '#D1FAE5',
              title: 'Unlock account?',
              message: `This will restore ${displayName}'s access to the app.`,
              confirmLabel: 'Unlock Account',
              confirmStyle: styles.confirmButtonSuccess,
            }
          : {
              icon: 'person-remove' as const,
              iconColor: '#DC2626',
              iconBg: '#FEE2E2',
              title: 'Remove connection?',
              message: `You will no longer be connected to ${displayName}. They won't see your location or check-ins.`,
              confirmLabel: 'Remove Connection',
              confirmStyle: styles.confirmButtonDanger,
            };

    return (
      <>
        <TouchableOpacity style={styles.backRow} onPress={handleBack} activeOpacity={0.75}>
          <Ionicons name="arrow-back" size={18} color="#6366F1" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.confirmHero}>
          <View style={[styles.confirmIconWrap, { backgroundColor: config.iconBg }]}>
            <Ionicons name={config.icon} size={28} color={config.iconColor} />
          </View>
          <Text style={styles.confirmTitle}>{config.title}</Text>
          <Text style={styles.confirmMessage}>{config.message}</Text>
        </View>

        <View style={styles.confirmActions}>
          <TouchableOpacity
            style={[styles.confirmButton, config.confirmStyle, submitting && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>{submitting ? 'Please wait...' : config.confirmLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleBack}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          {step === 'menu' ? renderMenu() : renderConfirm()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmergency: {
    backgroundColor: '#FEE2E2',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6366F1',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  profileHint: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionGroup: {
    gap: 10,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconWrapSuccess: {
    backgroundColor: '#ECFDF5',
  },
  actionIconWrapWarning: {
    backgroundColor: '#FFFBEB',
  },
  actionIconWrapDanger: {
    backgroundColor: '#FEF2F2',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  actionTitleDanger: {
    color: '#DC2626',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 16,
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  confirmHero: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    textAlign: 'center',
  },
  confirmActions: {
    gap: 10,
  },
  confirmButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonSuccess: {
    backgroundColor: '#059669',
  },
  confirmButtonWarning: {
    backgroundColor: '#D97706',
  },
  confirmButtonDanger: {
    backgroundColor: '#DC2626',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
