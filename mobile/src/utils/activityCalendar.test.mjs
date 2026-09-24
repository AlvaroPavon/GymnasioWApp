import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canValidate,
  classReminderEnabled,
  filterActivities,
  nearestClassDate,
  reservationHidesName,
  reservationIsFixed,
  sameDay
} from './activityCalendar.js';

const selectedDate = new Date('2026-08-25T12:00:00');
const classes = [
  {
    id: 1,
    tipo_clase_id: 10,
    start_time: '2026-08-25T09:00:00',
    reservations: [{ user: { id: 7 }, status: 'CONFIRMADA' }]
  },
  {
    id: 2,
    tipo_clase_id: 20,
    start_time: '2026-08-25T10:00:00',
    reservations: [{ user: { id: 7 }, status: 'EN_ESPERA' }]
  },
  {
    id: 3,
    tipo_clase_id: 10,
    start_time: '2026-08-25T11:00:00',
    reservations: [{ user: { id: 8 }, status: 'ASISTENCIA_VALIDADA' }]
  },
  {
    id: 4,
    tipo_clase_id: 10,
    start_time: '2026-08-26T08:00:00',
    own_reservation: { status: 'NO_ASISTE' },
    reservations: []
  }
];

const filter = (overrides = {}) => filterActivities({
  classes,
  selectedDate,
  view: 'calendar',
  typeFilter: 'all',
  statusFilter: 'all',
  role: 'CLIENT',
  userId: 7,
  ...overrides
}).map(({ id }) => id);

test('chooses today when today has classes and otherwise the next class day', () => {
  const now = new Date('2026-08-25T18:00:00');
  assert.equal(sameDay(nearestClassDate(classes, now), now), true);

  const withoutToday = classes.filter(({ id }) => id === 4);
  assert.equal(sameDay(nearestClassDate(withoutToday, now), new Date('2026-08-26T12:00:00')), true);
});

test('falls back to the most recent class day when no future classes exist', () => {
  const now = new Date('2026-08-25T12:00:00');
  const pastClasses = [
    { start_time: '2026-08-20T09:00:00' },
    { start_time: '2026-08-24T18:00:00' }
  ];

  assert.equal(sameDay(nearestClassDate(pastClasses, now), new Date('2026-08-24T12:00:00')), true);
  assert.equal(sameDay(nearestClassDate([], now), now), true);
});

test('keeps reservation and waitlist views role-aware', () => {
  assert.deepEqual(filter({ view: 'bookings', role: 'CLIENT' }), [1, 4]);
  assert.deepEqual(filter({ view: 'waitlist', role: 'CLIENT' }), [2]);
  assert.deepEqual(filter({ view: 'bookings', role: 'TEACHER' }), [1, 3]);
  assert.deepEqual(filter({ view: 'waitlist', role: 'TEACHER' }), [2]);
  assert.deepEqual(filter({ view: 'bookings', role: 'ADMIN' }), [1, 3]);
});

test('applies type and reservation-status filters consistently in every view', () => {
  assert.deepEqual(filter({ typeFilter: '10' }), [1, 3]);
  assert.deepEqual(filter({ statusFilter: 'CONFIRMADA', role: 'CLIENT' }), [1]);
  assert.deepEqual(filter({ statusFilter: 'ASISTENCIA_VALIDADA', role: 'TEACHER' }), [3]);
  assert.deepEqual(filter({ view: 'bookings', typeFilter: '10', statusFilter: 'CONFIRMADA', role: 'ADMIN' }), [1]);
  assert.deepEqual(filter({ view: 'waitlist', typeFilter: '20', statusFilter: 'EN_ESPERA', role: 'ADMIN' }), [2]);
});

test('requires ordinary confirmations to validate more than 30 minutes before class', () => {
  const reservation = { status: 'CONFIRMADA' };
  const startsAt = '2026-08-25T10:00:00.000Z';

  assert.equal(canValidate(reservation, startsAt, new Date('2026-08-25T09:29:59.999Z')), true);
  assert.equal(canValidate(reservation, startsAt, new Date('2026-08-25T09:30:00.000Z')), false);
});

test('allows late promotions through every current DTO alias before class start', () => {
  const startsAt = '2026-08-25T10:00:00.000Z';
  const now = new Date('2026-08-25T09:50:00.000Z');

  for (const promotedAtKey of ['promotedAt', 'promoted_at', 'promovida_en']) {
    assert.equal(canValidate({
      estado: 'CONFIRMADA',
      [promotedAtKey]: '2026-08-25T09:40:00.000Z'
    }, startsAt, now), true);
  }

  assert.equal(canValidate({
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T09:30:00.000Z'
  }, startsAt, now), true);
  assert.equal(canValidate({
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T09:29:59.999Z'
  }, startsAt, now), false);
  assert.equal(canValidate({
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T10:00:00.000Z'
  }, startsAt, now), false);
});

test('rejects attendance at or after class start and fails closed for invalid dates', () => {
  const reservation = {
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T09:40:00.000Z'
  };
  const startsAt = '2026-08-25T10:00:00.000Z';

  assert.equal(canValidate(reservation, startsAt, new Date('2026-08-25T10:00:00.000Z')), false);
  assert.equal(canValidate(reservation, startsAt, new Date('2026-08-25T10:00:00.001Z')), false);
  assert.equal(canValidate(reservation, 'invalid', new Date('2026-08-25T09:50:00.000Z')), false);
  assert.equal(canValidate({ ...reservation, promotedAt: 'invalid' }, startsAt, new Date('2026-08-25T09:50:00.000Z')), false);
});

test('normalizes enrollment privacy, fixed enrollment, and reminder aliases', () => {
  assert.equal(reservationHidesName({ hide_name: true }), true);
  assert.equal(reservationHidesName({ ocultar_nombre: false }), false);
  assert.equal(reservationIsFixed({ fixed_enrollment: true }), true);
  assert.equal(reservationIsFixed({ inscripcion_fija: false }), false);
  assert.equal(classReminderEnabled({ class_reminder_enabled: true }), true);
  assert.equal(classReminderEnabled({}), false);
});
