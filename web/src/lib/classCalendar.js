export const ACTIVE_RESERVATION_STATUSES = new Set(['CONFIRMADA', 'ASISTENCIA_VALIDADA']);

export function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekForDate(value) {
  const selected = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  const mondayOffset = (selected.getDay() + 6) % 7;
  selected.setDate(selected.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(selected);
    day.setDate(selected.getDate() + index);
    return day;
  });
}

export function reservationForUser(gymClass, userId) {
  if (!userId) return null;
  return gymClass?.reservations?.find((reservation) => (
    String(reservation.user?.id ?? reservation.userId) === String(userId)
  )) ?? null;
}

export function clientReservationActions(gymClass, userId) {
  const reservation = reservationForUser(gymClass, userId);
  const status = reservation?.status;

  return {
    reservation,
    canCancel: Boolean(status && !['CANCELADA', 'NO_ASISTE'].includes(status)),
    canReserve: !status || status === 'CANCELADA'
  };
}

export function effectiveClassImageUrl(gymClass) {
  return gymClass?.effectiveImageUrl
    || gymClass?.effective_image_url
    || gymClass?.imageUrl
    || gymClass?.image_url
    || gymClass?.classType?.imageUrl
    || gymClass?.classType?.image_url
    || '';
}

export function classCapacity(gymClass) {
  const occupied = Number(gymClass?._count?.reservations ?? 0);
  const maximum = Number(gymClass?.maxCapacity ?? gymClass?.max_capacity ?? 0);
  return {
    occupied,
    maximum,
    remaining: Math.max(maximum - occupied, 0),
    isFull: maximum > 0 && occupied >= maximum
  };
}

export function activityStatus(gymClass, { role, userId, now = new Date() }) {
  const end = new Date(gymClass.end_time || gymClass.endsAt);
  if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) {
    return { tone: 'finished', label: 'Finalizada' };
  }

  const ownReservation = reservationForUser(gymClass, userId);
  if (role === 'CLIENT' && ownReservation && ownReservation.status !== 'CANCELADA') {
    const labels = {
      CONFIRMADA: 'Reserva confirmada',
      EN_ESPERA: 'En lista de espera',
      ASISTENCIA_VALIDADA: 'Asistencia validada',
      NO_ASISTE: 'No asististe'
    };
    return {
      tone: ownReservation.status === 'EN_ESPERA' ? 'waitlist' : 'booked',
      label: labels[ownReservation.status] || 'Reserva activa'
    };
  }

  const capacity = classCapacity(gymClass);
  return capacity.isFull
    ? { tone: 'waitlist', label: 'Completa · lista de espera abierta' }
    : { tone: 'available', label: `${capacity.remaining} plazas disponibles` };
}

export function nearestUpcomingClassDate(classes, now = new Date()) {
  const nowTime = now.getTime();
  const nextClass = [...classes]
    .filter((gymClass) => new Date(gymClass.start_time || gymClass.startsAt).getTime() >= nowTime)
    .sort((left, right) => new Date(left.start_time || left.startsAt) - new Date(right.start_time || right.startsAt))[0];
  return nextClass ? localDateKey(nextClass.start_time || nextClass.startsAt) : localDateKey(now);
}

export function filterCalendarClasses(classes, options) {
  const {
    mode = 'calendar',
    selectedDate,
    typeId = 'all',
    status = 'all',
    role,
    userId
  } = options;

  return classes
    .filter((gymClass) => {
      const ownReservation = reservationForUser(gymClass, userId);
      const reservations = gymClass.reservations ?? [];
      if (mode === 'calendar' && localDateKey(gymClass.start_time || gymClass.startsAt) !== selectedDate) return false;
      if (mode === 'reservations') {
        if (role === 'CLIENT') return ownReservation && ownReservation.status !== 'EN_ESPERA' && ownReservation.status !== 'CANCELADA';
        return reservations.some((reservation) => ACTIVE_RESERVATION_STATUSES.has(reservation.status));
      }
      if (mode === 'waitlist') {
        if (role === 'CLIENT') return ownReservation?.status === 'EN_ESPERA';
        return reservations.some((reservation) => reservation.status === 'EN_ESPERA');
      }
      return true;
    })
    .filter((gymClass) => typeId === 'all' || String(gymClass.tipo_clase_id || gymClass.classTypeId) === String(typeId))
    .filter((gymClass) => {
      if (status === 'all') return true;
      const ownReservation = reservationForUser(gymClass, userId);
      if (role === 'CLIENT') return ownReservation?.status === status;
      return (gymClass.reservations ?? []).some((reservation) => reservation.status === status);
    })
    .sort((left, right) => new Date(left.start_time || left.startsAt) - new Date(right.start_time || right.startsAt));
}
