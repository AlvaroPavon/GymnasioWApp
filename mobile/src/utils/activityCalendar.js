const SPANISH_LOCALE = 'es-ES';

export const pad = (value) => String(value).padStart(2, '0');

export const startOf = (gymClass) => gymClass?.start_time || gymClass?.startsAt;
export const endOf = (gymClass) => gymClass?.end_time || gymClass?.endsAt;
export const capOf = (gymClass) => gymClass?.max_capacity || gymClass?.maxCapacity || 0;
export const typeOf = (gymClass) => gymClass?.tipo_clase_id || gymClass?.classTypeId;
export const teacherOf = (gymClass) => gymClass?.teacher_id || gymClass?.teacherId;

export const imgOf = (value) => (
  value?.effective_image_url
  || value?.effectiveImageUrl
  || value?.image_url
  || value?.imageUrl
  || value?.profile_picture
  || value?.profilePicture
  || value?.classType?.image_url
  || value?.classType?.imageUrl
  || ''
);

export const imageOverrideOf = (value) => (
  value?.image_override_url
  ?? value?.imageOverrideUrl
  ?? ''
);

export function withExplicitImageOverride(payload, { isEditing, value, originalValue }) {
  const imageOverride = typeof value === 'string' ? value.trim() : '';
  const originalOverride = typeof originalValue === 'string' ? originalValue.trim() : '';

  if (!isEditing) return imageOverride ? { ...payload, image_override_url: imageOverride } : payload;
  if (imageOverride === originalOverride) return payload;
  return { ...payload, image_override_url: imageOverride || null };
}

export const statusOf = (user) => user?.estado_mensualidad || user?.monthlyStatus || 'IMPAGADO';
export const expiryOf = (user) => user?.membership_expires_at || user?.membershipExpiresAt;
export const reservationStatus = (reservation) => reservation?.status || reservation?.estado;

export const canViewParticipantIdentities = (role) => role === 'ADMIN' || role === 'TEACHER';

export const canCancelReservation = (reservation) => (
  ['CONFIRMADA', 'EN_ESPERA', 'ASISTENCIA_VALIDADA'].includes(reservationStatus(reservation))
);

export const reservationLabel = (status) => ({
  CONFIRMADA: 'Confirmada',
  EN_ESPERA: 'En lista de espera',
  ASISTENCIA_VALIDADA: 'Asistencia validada',
  NO_ASISTE: 'No asistió',
  CANCELADA: 'Cancelada'
}[status] || status || 'Sin estado');

export const RESERVATION_STATUS_OPTIONS = [
  ['all', 'Todos los estados'],
  ['CONFIRMADA', 'Confirmada'],
  ['EN_ESPERA', 'En espera'],
  ['ASISTENCIA_VALIDADA', 'Asistencia validada'],
  ['NO_ASISTE', 'No asistió']
];

export const activeMembership = (user) => (
  user?.role !== 'CLIENT'
  || (statusOf(user) === 'PAGADO' && expiryOf(user) && new Date(expiryOf(user)).getTime() > Date.now())
);

const ATTENDANCE_CUTOFF_MS = 30 * 60 * 1000;

const timestampOf = (value) => {
  if (value === null || value === undefined || value === '') return Number.NaN;
  return new Date(value).getTime();
};

const promotedAtOf = (reservation) => (
  reservation?.promotedAt
  ?? reservation?.promoted_at
  ?? reservation?.promovida_en
);

export const canValidate = (reservation, startsAtValue, now = new Date()) => {
  if (reservationStatus(reservation) !== 'CONFIRMADA') return false;

  const startsAt = timestampOf(startsAtValue);
  const currentTime = timestampOf(now);
  if (!Number.isFinite(startsAt) || !Number.isFinite(currentTime)) return false;

  const timeUntilStart = startsAt - currentTime;
  if (timeUntilStart <= 0) return false;
  if (timeUntilStart > ATTENDANCE_CUTOFF_MS) return true;

  const promotedAt = timestampOf(promotedAtOf(reservation));
  return Number.isFinite(promotedAt)
    && promotedAt > startsAt - ATTENDANCE_CUTOFF_MS
    && promotedAt < startsAt;
};

export const dateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toIso = (value, label) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`${label} no es una fecha válida.`);
  return date.toISOString();
};

export const formatDateTime = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString(SPANISH_LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Sin fecha';
};

export const formatDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(SPANISH_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Sin vencimiento';
};

export const formatTimeRange = (startsAt, endsAt) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Horario por confirmar';
  const format = (date) => date.toLocaleTimeString(SPANISH_LOCALE, { hour: '2-digit', minute: '2-digit' });
  return `${format(start)} - ${format(end)}`;
};

export const sameDay = (left, right) => {
  const a = new Date(left);
  const b = new Date(right);
  return !Number.isNaN(a.getTime())
    && !Number.isNaN(b.getTime())
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
};

export const nearestClassDate = (classes, now = new Date()) => {
  const today = new Date(now);
  if (Number.isNaN(today.getTime())) return new Date();

  const classDates = (classes ?? [])
    .map((gymClass) => new Date(startOf(gymClass)))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (classDates.some((date) => sameDay(date, today))) return today;

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = classDates
    .filter((date) => date.getTime() >= startOfToday.getTime())
    .sort((left, right) => left.getTime() - right.getTime())[0];
  if (upcoming) return upcoming;

  return classDates.sort((left, right) => right.getTime() - left.getTime())[0] ?? today;
};

export const shiftDays = (value, amount) => {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

export const startOfWeek = (value) => {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
};

export const getWeekDays = (value) => {
  const monday = startOfWeek(value);
  return Array.from({ length: 7 }, (_, index) => shiftDays(monday, index));
};

export const weekdayLabel = (value) => new Date(value)
  .toLocaleDateString(SPANISH_LOCALE, { weekday: 'short' })
  .replace('.', '')
  .slice(0, 3);

export const monthLabel = (value) => {
  const label = new Date(value).toLocaleDateString(SPANISH_LOCALE, { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const isPastClass = (gymClass) => {
  const timestamp = new Date(endOf(gymClass) || startOf(gymClass)).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
};

const participantIdOf = (reservation) => (
  reservation?.user?.id
  ?? reservation?.userId
  ?? reservation?.user_id
);

const explicitOwnReservationOf = (gymClass) => (
  gymClass?.ownReservation
  ?? gymClass?.own_reservation
  ?? gymClass?.myReservation
  ?? gymClass?.my_reservation
  ?? null
);

export const reservationFor = (gymClass, userId) => {
  if (!userId) return null;

  const explicitOwnReservation = explicitOwnReservationOf(gymClass);
  if (explicitOwnReservation) return explicitOwnReservation;

  const reservations = Array.isArray(gymClass?.reservations) ? gymClass.reservations : [];
  const matchingReservation = reservations.find((reservation) => (
    participantIdOf(reservation) !== undefined
    && String(participantIdOf(reservation)) === String(userId)
  ));
  if (matchingReservation) return matchingReservation;

  // Privacy-reduced client payloads may contain only the caller's reservation,
  // without any participant identifier. A single anonymous entry is unambiguous.
  if (reservations.length === 1 && participantIdOf(reservations[0]) === undefined) return reservations[0];
  return null;
};

const hasReservationStatus = (gymClass, statuses, userId) => {
  if (userId) return statuses.includes(reservationStatus(reservationFor(gymClass, userId)));
  return (gymClass?.reservations ?? []).some((reservation) => statuses.includes(reservationStatus(reservation)));
};

export function filterActivities({
  classes,
  selectedDate,
  view = 'calendar',
  typeFilter = 'all',
  statusFilter = 'all',
  timeFilter = 'all',
  role,
  userId,
  isClient
}) {
  const clientView = role ? role === 'CLIENT' : !!isClient;

  return (classes ?? [])
    .filter((gymClass) => view !== 'calendar' || sameDay(startOf(gymClass), selectedDate))
    .filter((gymClass) => typeFilter === 'all' || String(typeOf(gymClass)) === String(typeFilter))
    .filter((gymClass) => {
      if (timeFilter === 'past') return isPastClass(gymClass);
      if (timeFilter === 'upcoming') return !isPastClass(gymClass);
      return true;
    })
    .filter((gymClass) => {
      if (view === 'waitlist') return hasReservationStatus(gymClass, ['EN_ESPERA'], clientView ? userId : undefined);
      if (view === 'bookings') {
        if (clientView) {
          const status = reservationStatus(reservationFor(gymClass, userId));
          return !!status && !['EN_ESPERA', 'CANCELADA'].includes(status);
        }
        return hasReservationStatus(
          gymClass,
          ['CONFIRMADA', 'ASISTENCIA_VALIDADA'],
          undefined
        );
      }
      return true;
    })
    .filter((gymClass) => {
      if (statusFilter === 'all') return true;
      return hasReservationStatus(gymClass, [statusFilter], clientView ? userId : undefined);
    })
    .sort((left, right) => new Date(startOf(left)).getTime() - new Date(startOf(right)).getTime());
}
