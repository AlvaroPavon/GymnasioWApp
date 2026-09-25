import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Bell,
  CalendarDots,
  ChartBar,
  ImageSquare,
  SlidersHorizontal,
  UsersThree
} from 'phosphor-react-native';
import { COLORS, RADII } from '../../theme';

const ICONS = {
  classes: CalendarDots,
  users: UsersThree,
  payments: Bell,
  images: ImageSquare,
  settings: SlidersHorizontal,
  stats: ChartBar
};

function DockItem({ id, label, active, badge, onPress, reduceMotion }) {
  const activeProgress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const Icon = ICONS[id] || CalendarDots;

  useEffect(() => {
    if (reduceMotion) {
      activeProgress.stopAnimation();
      activeProgress.setValue(active ? 1 : 0);
      return undefined;
    }
    Animated.spring(activeProgress, {
      toValue: active ? 1 : 0,
      damping: 17,
      stiffness: 230,
      mass: 0.75,
      useNativeDriver: true
    }).start();
    return () => activeProgress.stopAnimation();
  }, [active, activeProgress, reduceMotion]);

  const animatePress = (toValue) => {
    if (reduceMotion) {
      pressScale.setValue(toValue);
      return;
    }
    Animated.spring(pressScale, {
      toValue,
      damping: 16,
      stiffness: 360,
      useNativeDriver: true
    }).start();
  };

  const scale = Animated.multiply(
    activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
    pressScale
  );
  const translateY = activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={badge ? `${label}, ${badge} ${badge === 1 ? 'aviso pendiente' : 'avisos pendientes'}` : label}
        onPress={onPress}
        onPressIn={() => animatePress(0.92)}
        onPressOut={() => animatePress(1)}
        style={styles.item}
      >
        <Animated.View pointerEvents="none" style={[styles.activePill, { opacity: activeProgress }]} />
        <View>
          <Icon size={21} color={active ? '#111216' : COLORS.textSecondary} weight={active ? 'fill' : 'duotone'} />
          {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
        </View>
        <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function AnimatedTabDock({ tabs, activeTab, unread = 0, onChange, bottomInset = 0 }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!tabs?.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.positioner, { bottom: Math.max(bottomInset, 6) }]}>
      <View accessibilityRole="tablist" style={styles.dock}>
        <ScrollView
          horizontal
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {tabs.map(([id, label]) => (
            <DockItem
              key={id}
              id={id}
              label={label}
              active={activeTab === id}
              badge={id === 'payments' ? unread : 0}
              reduceMotion={reduceMotion}
              onPress={() => onChange(id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: { position: 'absolute', left: 12, right: 12, zIndex: 50 },
  dock: {
    minHeight: 70,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: 'rgba(24,24,27,0.97)',
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
    overflow: 'hidden'
  },
  content: { minWidth: '100%', flexGrow: 1, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, paddingVertical: 6, gap: 1 },
  item: { minWidth: 51, minHeight: 56, borderRadius: 22, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 3, overflow: 'hidden' },
  activePill: { ...StyleSheet.absoluteFillObject, borderRadius: 22, backgroundColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.36, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  label: { maxWidth: 54, color: COLORS.textSecondary, fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  labelActive: { color: '#111216' },
  badge: { position: 'absolute', right: -8, top: -6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger },
  badgeText: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '900' }
});
