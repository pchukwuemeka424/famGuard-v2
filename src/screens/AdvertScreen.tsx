import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Advert } from '../types';

interface AdvertScreenProps {
  advert: Advert;
  onFinish: () => void;
}

export default function AdvertScreen({ advert, onFinish }: AdvertScreenProps) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(advert.timer, 0));
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    const durationMs = Math.max(advert.timer, 0) * 1000;

    if (durationMs <= 0) {
      finish();
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    const timeout = setTimeout(finish, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [advert.timer]);

  const timerLabel = `${secondsLeft}s`;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ImageBackground
        source={{ uri: advert.image }}
        style={styles.image}
        resizeMode="cover"
        onLoadEnd={() => setImageLoaded(true)}
        onError={finish}
      >
        {!imageLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{timerLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Skip advert"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  timerBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
