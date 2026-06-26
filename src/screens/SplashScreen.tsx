import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, ImageBackground } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const SPLASH_IMAGE = require('../../assets/home/splash.png');

const DISPLAY_DURATION_MS = 2500;
const FADE_DURATION_MS = 400;

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      onFinish?.();
    });
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(finish, DISPLAY_DURATION_MS);

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar style="dark" />
      <ImageBackground
        source={SPLASH_IMAGE}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
