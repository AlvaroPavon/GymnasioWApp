import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activityStatus,
  classCapacity,
  clientReservationActions,
  effectiveClassImageUrl,
  filterCalendarClasses,
  localDateKey,
  reservationForUser,
  weekForDate
} from './classCalendar.js';
import { canValidateAttendance } from './api.js';

const classes = [
  {
    id: 1,
    start_time: '2026-08-14T09:00:00',
    tipo_clase_id: 2,
    reservations: [{ user: { id: 7 }, status: 'CONFIRMADA' }]
  },
  {
    id: 2,
    start_time: '2026-08-15T10:00:00',
    tipo_clase_id: 3,
    reservations: [{ user: { id: 7 }, status: 'EN_ESPERA' }]
  }
];

test('builds a Monday-to-Sunday strip around the selected date', () => {
  const week = weekForDate('2026-08-14');
  assert.deepEqual(week.map(localDateKey), [
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'
  ]);
});

test('filters client reservations and waitlist independently', () => {
  assert.equal(filterCalendarClasses(classes, { mode: 'reservations', role: 'CLIENT', userId: 7 }).length, 1);
  assert.equal(filterCalendarClasses(classes, { mode: 'waitlist', role: 'CLIENT', userId: 7 })[0].id, 2);
  assert.equal(reservationForUser(classes[0], 7)?.status, 'CONFIRMADA');
});

test('filters calendar by local selected day and class type', () => {
  const result = filterCalendarClasses(classes, {
    mode: 'calendar',
    selectedDate: '2026-08-14',
    typeId: '2',
    role: 'ADMIN'
  });
  assert.deepEqual(result.map((gymClass) => gymClass.id), [1]);
});

test('normalizes effective images and capacity for activity cards', () => {
  const gymClass = {
    image_url: 'https://cdn.example.test/yoga.jpg',
    max_capacity: 12,
    _count: { reservations: 12 }
  };
  assert.equal(effectiveClassImageUrl(gymClass), 'https://cdn.example.test/yoga.jpg');
  assert.deepEqual(classCapacity(gymClass), {
    occupied: 12,
    maximum: 12,
    remaining: 0,
    isFull: true
  });
});

test('builds client-facing activity status from reservation and time', () => {
  const waitlisted = {
    start_time: '2026-08-17T10:00:00',
    end_time: '2026-08-17T11:00:00',
    max_capacity: 1,
    _count: { reservations: 1 },
    reservations: [{ userId: 7, status: 'EN_ESPERA' }]
  };
  assert.deepEqual(activityStatus(waitlisted, {
    role: 'CLIENT',
    userId: '7',
    now: new Date('2026-08-17T09:00:00')
  }), { tone: 'waitlist', label: 'En lista de espera' });
  assert.equal(reservationForUser(waitlisted, '7')?.status, 'EN_ESPERA');

  assert.deepEqual(activityStatus(waitlisted, {
    role: 'CLIENT',
    userId: 7,
    now: new Date('2026-08-17T12:00:00')
  }), { tone: 'finished', label: 'Finalizada' });
});

test('hides cancel and rebook actions after a no-show', () => {
  const noShowClass = {
    reservations: [{ userId: 7, status: 'NO_ASISTE' }]
  };

  assert.deepEqual(clientReservationActions(noShowClass, 7), {
    reservation: noShowClass.reservations[0],
    canCancel: false,
    canReserve: false
  });
  assert.equal(clientReservationActions({ reservations: [] }, 7).canReserve, true);
  assert.equal(clientReservationActions({ reservations: [{ userId: 7, status: 'CANCELADA' }] }, 7).canReserve, true);
});

test('requires ordinary confirmations to validate more than 30 minutes before class', () => {
  const reservation = { status: 'CONFIRMADA' };
  const startsAt = '2026-08-25T10:00:00.000Z';

  assert.equal(canValidateAttendance(reservation, startsAt, new Date('2026-08-25T09:29:59.999Z')), true);
  assert.equal(canValidateAttendance(reservation, startsAt, new Date('2026-08-25T09:30:00.000Z')), false);
});

test('allows late promotions through every current DTO alias before class start', () => {
  const startsAt = '2026-08-25T10:00:00.000Z';
  const now = new Date('2026-08-25T09:50:00.000Z');

  for (const promotedAtKey of ['promotedAt', 'promoted_at', 'promovida_en']) {
    assert.equal(canValidateAttendance({
      estado: 'CONFIRMADA',
      [promotedAtKey]: '2026-08-25T09:40:00.000Z'
    }, startsAt, now), true);
  }

  assert.equal(canValidateAttendance({
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T09:30:00.000Z'
  }, startsAt, now), true);
  assert.equal(canValidateAttendance({
    status: 'CONFIRMADA',
    promotedAt: '2026-08-25T09:29:59.999Z'
  }, startsAt, now), false);
  assert.equal(canValidateAttendance({
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

  assert.equal(canValidateAttendance(reservation, startsAt, new Date('2026-08-25T10:00:00.000Z')), false);
  assert.equal(canValidateAttendance(reservation, startsAt, new Date('2026-08-25T10:00:00.001Z')), false);
  assert.equal(canValidateAttendance(reservation, 'invalid', new Date('2026-08-25T09:50:00.000Z')), false);
  assert.equal(canValidateAttendance({ ...reservation, promotedAt: 'invalid' }, startsAt, new Date('2026-08-25T09:50:00.000Z')), false);
});
