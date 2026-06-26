import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from '../types';

const getTabColor = (routeName: keyof MainTabParamList): string => {
  switch (routeName) {
    case 'Home':
      return '#0F4C4A';
    case 'CheckIn':
      return '#10B981';
    case 'Incidents':
      return '#EF4444';
    case 'Connections':
      return '#6366F1';
    case 'Profile':
      return '#8B5CF6';
    default:
      return '#007AFF';
  }
};

const getIconName = (
  routeName: keyof MainTabParamList,
  focused: boolean
): keyof typeof Ionicons.glyphMap => {
  switch (routeName) {
    case 'Home':
      return focused ? 'map' : 'map-outline';
    case 'CheckIn':
      return focused ? 'shield-checkmark' : 'shield-checkmark-outline';
    case 'Incidents':
      return focused ? 'alert-circle' : 'alert-circle-outline';
    case 'Connections':
      return focused ? 'people' : 'people-outline';
    case 'Profile':
      return focused ? 'person' : 'person-outline';
    default:
      return 'help-outline';
  }
};

type AnimatedTabIconProps = {
  routeName: keyof MainTabParamList;
  focused: boolean;
  color: string;
};

function AnimatedTabIcon({ routeName, focused, color }: AnimatedTabIconProps) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.1, { damping: 14, stiffness: 220 });
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400 }),
          withTiming(0, { duration: 1400 })
        ),
        -1,
        false
      );
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [focused, pulse, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: focused ? 0.12 + pulse.value * 0.2 : 0,
    transform: [{ scale: 1.4 + pulse.value * 0.35 }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.iconGlow,
          { backgroundColor: color },
          glowStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <Ionicons name={getIconName(routeName, focused)} size={24} color={color} />
      </Animated.View>
    </View>
  );
}

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const routeName = route.name as keyof MainTabParamList;
          const isFocused = state.index === index;
          const color = getTabColor(routeName);
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <AnimatedTabIcon routeName={routeName} focused={isFocused} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    gap: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
