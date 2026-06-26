import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const HEADER_BLOBS = require('../../assets/home/header-blobs.png');

/**
 * Colorful organic blob cluster for the header right side.
 */
export default function HeaderBlobDecoration() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Image source={HEADER_BLOBS} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: -36,
    top: -24,
    width: 200,
    height: 130,
    zIndex: 0,
    opacity: 0.92,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
