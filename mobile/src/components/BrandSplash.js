import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADII } from '../theme';

const brandLogo = require('../../assets/logo.jpg');

export default function BrandSplash({ onFinished, onReady }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const copyOffset = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    let active = true;
    let animation;
    let finishTimer;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) {
        logoScale.setValue(1);
        logoOpacity.setValue(1);
        copyOffset.setValue(0);
        finishTimer = setTimeout(() => {
          if (active) onFinished?.();
        }, 500);
        return;
      }

      animation = Animated.sequence([
        Animated.parallel([
          Animated.spring(logoScale, {
            toValue: 1,
            damping: 14,
            stiffness: 125,
            mass: 0.8,
            useNativeDriver: true
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(copyOffset, {
            toValue: 0,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.delay(650),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true
        })
      ]);

      animation.start(({ finished }) => {
        if (finished && active) onFinished?.();
      });
    });

    return () => {
      active = false;
      animation?.stop();
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [copyOffset, logoOpacity, logoScale, onFinished, opacity]);

  return (
    <View
      accessibilityLabel="Iniciando Ronquillo Te Cuida"
      accessibilityViewIsModal
      importantForAccessibility="yes"
      onLayout={onReady}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity }]}>
        <Animated.View style={[styles.logoFrame, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image source={brandLogo} resizeMode="contain" style={styles.logo} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: copyOffset }] }}>
          <Text style={styles.title}>RONQUILLO</Text>
          <Text style={styles.subtitle}>TE CUIDA</Text>
        </Animated.View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progress, { opacity: logoOpacity }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36
  },
  logoFrame: {
    width: '100%',
    maxWidth: 330,
    height: 218,
    padding: 12,
    borderRadius: RADII.xl,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12
  },
  logo: { width: '100%', height: '100%', borderRadius: RADII.large },
  title: { color: COLORS.text, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: 2.2, textAlign: 'center', marginTop: 27 },
  subtitle: { color: COLORS.accent, fontSize: 13, lineHeight: 18, fontWeight: '900', letterSpacing: 6, textAlign: 'center', marginTop: 2 },
  progressTrack: { width: 82, height: 3, borderRadius: 2, backgroundColor: COLORS.elevated, overflow: 'hidden', marginTop: 28 },
  progress: { width: '72%', height: '100%', alignSelf: 'center', borderRadius: 2, backgroundColor: COLORS.accent }
});
