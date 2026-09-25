const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const getDefaultApiBaseUrl = () => {
  if (import.meta.env?.DEV) return 'http://localhost:3000';
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
};

const configuredApiBaseUrl = import.meta.env?.VITE_API_URL?.trim();
export const API_BASE_URL = trimTrailingSlash(configuredApiBaseUrl || getDefaultApiBaseUrl());
export const API_URL = `${API_BASE_URL}/api`;

export function getApiErrorMessage(error, fallback = 'Operación fallida') {
  const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (error?.code === 'ECONNABORTED') return 'La solicitud tardó demasiado. Inténtalo de nuevo.';
  if (error?.code === 'ERR_NETWORK' || !error?.response) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  return fallback;
}

export const OCCUPYING_STATUSES = new Set(['CONFIRMADA', 'ASISTENCIA_VALIDADA']);

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

export function canValidateAttendance(reservation, startTime, now = new Date()) {
  if (!reservation || (reservation.status ?? reservation.estado) !== 'CONFIRMADA') return false;

  const startsAt = timestampOf(startTime);
  const currentTime = timestampOf(now);
  if (!Number.isFinite(startsAt) || !Number.isFinite(currentTime)) return false;

  const timeUntilStart = startsAt - currentTime;
  if (timeUntilStart <= 0) return false;
  if (timeUntilStart > ATTENDANCE_CUTOFF_MS) return true;

  const promotedAt = timestampOf(promotedAtOf(reservation));
  return Number.isFinite(promotedAt)
    && promotedAt >= startsAt - ATTENDANCE_CUTOFF_MS
    && promotedAt < startsAt;
}

export function reservationStatusLabel(status) {
  const labels = {
    CONFIRMADA: 'Confirmada',
    EN_ESPERA: 'En espera',
    ASISTENCIA_VALIDADA: 'Asistencia validada',
    NO_ASISTE: 'No asiste',
    CANCELADA: 'Cancelada'
  };
  return labels[status] || status || 'Sin reserva';
}

export function reservationStatusClass(status) {
  const classes = {
    CONFIRMADA: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    EN_ESPERA: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    ASISTENCIA_VALIDADA: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    NO_ASISTE: 'bg-red-500/20 text-red-300 border-red-500/30',
    CANCELADA: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  };
  return classes[status] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

export function dateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function membershipExpiresAtEndOfDay(value) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59`).toISOString();
}

export function isClientMembershipActive(user) {
  if (!user || user.role !== 'CLIENT') return true;
  if (user.estado_mensualidad !== 'PAGADO') return false;
  if (!user.membership_expires_at) return false;
  return new Date(user.membership_expires_at).getTime() > Date.now();
}
