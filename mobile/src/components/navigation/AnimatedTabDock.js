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
  const scale = useRef(new Animated.Value(active ? 1 : 0.94)).current;
  const Icon = ICONS[id] || CalendarDots;

  useEffect(() => {
    if (reduceMotion) {
      scale.stopAnimation();
      scale.setValue(active ? 1 : 0.94);
      return undefined;
    }
    Animated.spring(scale, {
      toValue: active ? 1 : 0.94,
      damping: 16,
      stiffness: 210,
      useNativeDriver: true
    }).start();
    return () => scale.stopAnimation();
  }, [active, reduceMotion, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.itemPressed]}
      >
        <View>
          <Icon size={21} color={active ? '#19120a' : COLORS.textSecondary} weight={active ? 'fill' : 'duotone'} />
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
  item: { minWidth: 51, minHeight: 56, borderRadius: 22, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 3 },
  itemActive: { backgroundColor: COLORS.gold },
  itemPressed: { opacity: 0.72 },
  label: { maxWidth: 54, color: COLORS.textMuted, fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  labelActive: { color: '#19120a' },
  badge: { position: 'absolute', right: -8, top: -6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.danger },
  badgeText: { color: '#fff', fontSize: 8, lineHeight: 10, fontWeight: '900' }
});
