import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../context/LanguageContext';
import type { FamilyMember, UserCheckIn } from '../types';

interface CheckInConnectionPickerProps {
  visible: boolean;
  status: UserCheckIn['status'];
  connections: FamilyMember[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: (selectedUserIds: string[]) => void;
}

const STATUS_VISUALS: Record<
  'safe' | 'delayed',
  {
    gradient: [string, string];
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
  }
> = {
  safe: {
    gradient: ['#10B981', '#059669'],
    icon: 'checkmark-circle',
    iconColor: '#10B981',
  },
  delayed: {
    gradient: ['#F59E0B', '#D97706'],
    icon: 'time',
    iconColor: '#F59E0B',
  },
};

export default function CheckInConnectionPicker({
  visible,
  status,
  connections,
  submitting,
  onClose,
  onConfirm,
}: CheckInConnectionPickerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const statusKey = status === 'delayed' ? 'delayed' : 'safe';
  const config = useMemo(() => {
    const visuals = STATUS_VISUALS[statusKey];
    if (statusKey === 'delayed') {
      return {
        title: t('checkInPicker.delayedTitle'),
        subtitle: t('checkInPicker.delayedSubtitle'),
        confirmLabel: t('checkInPicker.sendDelayedUpdate'),
        ...visuals,
      };
    }
    return {
      title: t('checkInPicker.safeTitle'),
      subtitle: t('checkInPicker.safeSubtitle'),
      confirmLabel: t('checkInPicker.sendSafeCheckIn'),
      ...visuals,
    };
  }, [statusKey, t]);
  const selectableConnections = useMemo(
    () => connections.filter((connection) => connection.userId),
    [connections]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
    }
  }, [visible]);

  const toggleConnection = (userId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAll = (): void => {
    setSelectedIds(new Set(selectableConnections.map((c) => c.userId!)));
  };

  const clearAll = (): void => {
    setSelectedIds(new Set());
  };

  const handleConfirm = (): void => {
    onConfirm(Array.from(selectedIds));
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.75}
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        <LinearGradient colors={config.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name={config.icon} size={28} color={config.iconColor} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{config.title}</Text>
            <Text style={styles.heroSubtitle}>{config.subtitle}</Text>
          </View>
        </LinearGradient>

        <View style={styles.toolbar}>
          <Text style={styles.toolbarLabel}>
            {t('checkInPicker.selectedCount', {
              selected: selectedIds.size,
              total: selectableConnections.length,
            })}
          </Text>
          <View style={styles.toolbarActions}>
            <TouchableOpacity onPress={selectAll} activeOpacity={0.7}>
              <Text style={styles.toolbarAction}>{t('checkInPicker.selectAll')}</Text>
            </TouchableOpacity>
            <Text style={styles.toolbarDivider}>·</Text>
            <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
              <Text style={styles.toolbarAction}>{t('checkInPicker.clear')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
            {selectableConnections.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>{t('checkInPicker.noConnectionsTitle')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('checkInPicker.noConnectionsSubtitle')}
                </Text>
              </View>
            ) : (
              selectableConnections.map((connection) => {
                const userId = connection.userId!;
                const isSelected = selectedIds.has(userId);

                return (
                  <TouchableOpacity
                    key={connection.id}
                    style={[styles.connectionRow, isSelected && styles.connectionRowSelected]}
                    onPress={() => toggleConnection(userId)}
                    activeOpacity={0.85}
                  >
                    {connection.photo ? (
                      <Image source={{ uri: connection.photo }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarInitials}>{getInitials(connection.name)}</Text>
                      </View>
                    )}

                    <View style={styles.connectionInfo}>
                      <Text style={styles.connectionName}>{connection.name}</Text>
                      <Text style={styles.connectionMeta}>
                        {connection.relationship || t('common.connection')}
                      </Text>
                    </View>

                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              (selectedIds.size === 0 || submitting) && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={selectedIds.size === 0 || submitting}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={selectedIds.size === 0 || submitting ? ['#94A3B8', '#94A3B8'] : config.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>{config.confirmLabel}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 4,
    lineHeight: 18,
    fontWeight: '500',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  toolbarLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  toolbarDivider: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  connectionRowSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  connectionMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  confirmButton: {
    flex: 1.6,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
