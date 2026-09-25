import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  capOf,
  formatTimeRange,
  imgOf,
  monthLabel,
  sameDay,
  weekdayLabel
} from '../../utils/activityCalendar';

const VIEW_OPTIONS = [
  ['calendar', 'Calendario'],
  ['bookings', 'Reservas'],
  ['waitlist', 'Lista de espera']
];

export function ActivitySegments({ value, onChange }) {
  return (
    <View accessibilityRole="tablist" style={styles.segments}>
      {VIEW_OPTIONS.map(([id, label]) => {
        const selected = value === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={4}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && styles.pressed
            ]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActivitySiteRow({ siteName, filterCount, onOpenFilters }) {
  return (
    <View style={styles.siteRow}>
      <View
        accessibilityLabel={`Centro seleccionado: ${siteName}`}
        accessibilityRole="text"
        style={styles.siteSelector}
      >
        <Text numberOfLines={1} style={styles.siteName}>{siteName}</Text>
        <Text style={styles.singleSite}>Centro único</Text>
      </View>
      <Pressable
        accessibilityLabel={`Abrir filtros${filterCount ? `, ${filterCount} activos` : ''}`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={onOpenFilters}
        style={({ pressed }) => [styles.filterButton, filterCount > 0 && styles.filterButtonActive, pressed && styles.pressed]}
      >
        <Text style={styles.filterButtonText}>{filterCount ? `Filtros ${filterCount}` : 'Filtros'}</Text>
      </Pressable>
    </View>
  );
}

export function ActivityWeekStrip({ selectedDate, days, onSelectDate, onPreviousWeek, onNextWeek, showsAllDates = false }) {
  return (
    <View>
      <View style={styles.monthRow}>
        <Text style={styles.month}>{monthLabel(selectedDate)}</Text>
        <View style={styles.weekActions}>
          <Pressable
            accessibilityLabel="Semana anterior"
            accessibilityRole="button"
            onPress={onPreviousWeek}
            style={({ pressed }) => [styles.weekButton, pressed && styles.pressed]}
          >
            <Text style={styles.weekButtonText}>Ant.</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Semana siguiente"
            accessibilityRole="button"
            onPress={onNextWeek}
            style={({ pressed }) => [styles.weekButton, pressed && styles.pressed]}
          >
            <Text style={styles.weekButtonText}>Sig.</Text>
          </Pressable>
        </View>
      </View>
      {showsAllDates ? (
        <Text accessibilityLiveRegion="polite" style={styles.allDatesNote}>
          Mostrando actividades de todas las fechas
        </Text>
      ) : null}
      <View style={styles.weekStrip}>
        {days.map((day) => {
          const selected = sameDay(day, selectedDate);
          const today = sameDay(day, new Date());
          return (
            <Pressable
              key={day.toISOString()}
              accessibilityLabel={day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectDate(day)}
              style={({ pressed }) => [
                styles.day,
                selected && styles.daySelected,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.weekday, selected && styles.dayTextSelected]}>{weekdayLabel(day)}</Text>
              <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>{day.getDate()}</Text>
              {today && !selected ? <View accessibilityLabel="Hoy" style={styles.todayMarker} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CardAction({ action, secondary }) {
  if (!action && !secondary) return null;
  return (
    <View style={styles.cardActions}>
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          disabled={secondary.disabled}
          onPress={secondary.onPress}
          style={({ pressed }) => [styles.action, styles.actionSecondary, secondary.disabled && styles.actionDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.actionSecondaryText}>{secondary.label}</Text>
        </Pressable>
      ) : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            action.tone === 'success' && styles.actionSuccess,
            action.tone === 'warning' && styles.actionWarning,
            action.tone === 'danger' && styles.actionDanger,
            action.tone === 'outline' && styles.actionOutline,
            action.disabled && styles.actionDisabled,
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.actionText, action.tone === 'warning' && styles.actionWarningText, action.tone === 'outline' && styles.actionOutlineText]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ActivityCard({ gymClass, status, action, secondaryAction, onOpen }) {
  const image = imgOf(gymClass);
  const capacity = capOf(gymClass);
  const reserved = gymClass?._count?.reservations || 0;
  const title = gymClass?.title || gymClass?.titulo || 'Actividad';
  const classType = gymClass?.classType?.name || gymClass?.classType?.nombre || 'Actividad dirigida';
  const teacher = gymClass?.teacher?.name || 'Equipo del centro';

  return (
    <View style={[styles.card, { borderLeftColor: status.accent }]}>
      <Pressable
        accessibilityHint="Abre los detalles y acciones de la actividad"
        accessibilityLabel={`${title}, ${formatTimeRange(gymClass?.start_time || gymClass?.startsAt, gymClass?.end_time || gymClass?.endsAt)}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.cardPressed}
      >
        {image ? (
          <Image
            accessibilityLabel={`Imagen de ${title}`}
            resizeMode="cover"
            source={{ uri: image }}
            style={styles.cardImage}
          />
        ) : null}
        <View style={styles.cardBody}>
          <View style={styles.cardEyebrowRow}>
            <Text numberOfLines={1} style={styles.cardType}>{classType}</Text>
            <Text numberOfLines={1} style={styles.cardTime}>
              {formatTimeRange(gymClass?.start_time || gymClass?.startsAt, gymClass?.end_time || gymClass?.endsAt)}
            </Text>
          </View>
          <Text numberOfLines={2} style={styles.cardTitle}>{title}</Text>
          <View style={styles.cardMetaGrid}>
            <View style={styles.cardMetaColumn}>
              <Text style={styles.cardMetaLabel}>Profesor</Text>
              <Text numberOfLines={1} style={styles.cardMetaValue}>{teacher}</Text>
            </View>
            <View style={styles.cardMetaColumn}>
              <Text style={styles.cardMetaLabel}>Ocupación</Text>
              <Text style={styles.cardMetaValue}>{reserved}/{capacity} plazas</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { borderColor: status.accent }]}>
              <Text style={[styles.statusText, { color: status.accent }]}>{status.label}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      <CardAction action={action} secondary={secondaryAction} />
    </View>
  );
}

export function ActivityMessage({ title, message, actionLabel, onAction, tone = 'neutral' }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.message, tone === 'error' && styles.messageError]}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageText}>{message}</Text>
      {onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.messageAction, pressed && styles.pressed]}
        >
          <Text style={styles.messageActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  segments: { flexDirection: 'row', gap: 8, padding: 4, marginBottom: 18 },
  segment: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#1d1d1d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentSelected: { backgroundColor: '#f8f8f8' },
  segmentText: { color: '#8e8e93', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  segmentTextSelected: { color: '#111111' },
  siteRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  siteSelector: { flex: 1, minHeight: 64, borderRadius: 22, backgroundColor: '#1e1e1e', paddingHorizontal: 18, justifyContent: 'center' },
  siteName: { color: '#f4f4f5', fontSize: 16, fontWeight: '900' },
  singleSite: { color: '#8e8e93', fontSize: 11, fontWeight: '700', marginTop: 2 },
  filterButton: { minWidth: 72, minHeight: 64, borderRadius: 22, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  filterButtonActive: { borderWidth: 1, borderColor: '#ff5a47' },
  filterButtonText: { color: '#f4f4f5', fontSize: 12, fontWeight: '900' },
  monthRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  month: { color: '#9a9a9f', fontSize: 16, fontWeight: '800' },
  weekActions: { flexDirection: 'row', gap: 4 },
  weekButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  weekButtonText: { color: '#b5b5ba', fontSize: 12, fontWeight: '800' },
  allDatesNote: { color: '#8e8e93', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: -2, marginBottom: 8 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  day: { width: '13.3%', minHeight: 68, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#f8f8f8' },
  weekday: { color: '#8e8e93', fontSize: 12, fontWeight: '800', textTransform: 'lowercase' },
  dayNumber: { color: '#a6a6aa', fontSize: 18, fontWeight: '900', marginTop: 2 },
  dayTextSelected: { color: '#111111' },
  todayMarker: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#ff5a47', marginTop: 4 },
  card: { backgroundColor: '#1d1d1d', borderRadius: 22, borderLeftWidth: 5, marginBottom: 16, overflow: 'hidden' },
  cardPressed: { opacity: 0.86 },
  cardImage: { width: '100%', height: 136, backgroundColor: '#282828' },
  cardBody: { paddingHorizontal: 17, paddingTop: 16, paddingBottom: 14 },
  cardEyebrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardType: { flex: 1, color: '#96969b', fontSize: 11, lineHeight: 16, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardTitle: { color: '#f7f7f8', fontSize: 20, lineHeight: 23, fontWeight: '900', textTransform: 'uppercase', marginTop: 5 },
  cardTime: { color: '#f7f7f8', fontSize: 15, lineHeight: 21, fontWeight: '900', textAlign: 'right' },
  cardMetaGrid: { flexDirection: 'row', gap: 12, marginTop: 15 },
  cardMetaColumn: { flex: 1, minWidth: 0 },
  cardMetaLabel: { color: '#747479', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardMetaValue: { color: '#b5b5ba', fontSize: 12, lineHeight: 18, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  statusPill: { minHeight: 34, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  statusText: { fontSize: 12, fontWeight: '900' },
  cardActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  action: { flex: 1, minHeight: 48, borderRadius: 24, backgroundColor: '#ff5a47', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionSuccess: { backgroundColor: '#168a62' },
  actionWarning: { backgroundColor: '#f5c44d' },
  actionDanger: { backgroundColor: '#8d3040' },
  actionOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#747479' },
  actionSecondary: { flex: 0.78, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#57575b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  actionDisabled: { opacity: 0.48 },
  actionText: { color: '#19120a', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  actionWarningText: { color: '#171717' },
  actionOutlineText: { color: '#d4d4d8' },
  actionSecondaryText: { color: '#d4d4d8', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  message: { backgroundColor: '#1d1d1d', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 },
  messageError: { borderWidth: 1, borderColor: '#a33b4b' },
  messageTitle: { color: '#f7f7f8', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  messageText: { color: '#929297', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  messageAction: { minHeight: 48, borderRadius: 24, backgroundColor: '#f3f3f4', justifyContent: 'center', paddingHorizontal: 22, marginTop: 14 },
  messageActionText: { color: '#161616', fontSize: 13, fontWeight: '900' }
});
