/**
 * Copyright 2016 DanceDeets.
 *
 * @flow
 */

import React from 'react';
import {
  StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export default function BottomFade({ style, ...props }: Object): LinearGradient {
  return <LinearGradient
      start={[0.0, 0.0]} end={[0.0, 1.0]}
      locations={[0.0, 0.8, 1.0]}
      colors={['#00000000', '#000000CC', '#000000CC']}
      style={styles.bottomFade}
    />;
}

const styles = StyleSheet.create({
  bottomFade: {
    position: 'absolute',
    flex: 1,
    height: 100,
    bottom: 0,
    left: 0,
    right: 0,
  },
});