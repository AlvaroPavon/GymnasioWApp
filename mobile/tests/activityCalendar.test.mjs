import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCancelReservation,
  canViewParticipantIdentities,
  filterActivities,
  imageOverrideOf,
  reservationFor,
  withExplicitImageOverride
} from '../src/utils/activityCalendar.js';

const classes = [
  {
    id: 3,
    start_time: '2026-08-16T10:00:00',
    reservations: [{ userId: 7, status: 'ASISTENCIA_VALIDADA' }]
  },
  {
    id: 1,
    start_time: '2026-08-14T09:00:00',
    reservations: [{ user: { id: 7 }, status: 'CONFIRMADA' }]
  },
  {
    id: 4,
    start_time: '2026-08-13T08:00:00',
    reservations: [{ status: 'NO_ASISTE' }]
  },
  {
    id: 2,
    start_time: '2026-08-15T11:00:00',
    own_reservation: { status: 'EN_ESPERA' },
    reservations: []
  }
];

const filterOptions = {
  classes,
  selectedDate: new Date('2026-08-14T12:00:00'),
  typeFilter: 'all',
  timeFilter: 'all',
  userId: '7',
  isClient: true
};

test('applies the selected day only to calendar and keeps other views sorted across dates', () => {
  assert.deepEqual(filterActivities({ ...filterOptions, view: 'calendar' }).map(({ id }) => id), [1]);
  assert.deepEqual(filterActivities({ ...filterOptions, view: 'bookings' }).map(({ id }) => id), [4, 1, 3]);
  assert.deepEqual(filterActivities({ ...filterOptions, view: 'waitlist' }).map(({ id }) => id), [2]);
});

test('recognizes the caller reservation in privacy-reduced payloads', () => {
  assert.equal(reservationFor({ ownReservation: { status: 'CONFIRMADA' } }, 7)?.status, 'CONFIRMADA');
  assert.equal(reservationFor({ reservations: [{ user_id: '7', status: 'EN_ESPERA' }] }, 7)?.status, 'EN_ESPERA');
  assert.equal(reservationFor({ reservations: [{ status: 'NO_ASISTE' }] }, 7)?.status, 'NO_ASISTE');
});

test('keeps participant identities private to management roles and blocks no-show cancellation', () => {
  assert.equal(canViewParticipantIdentities('CLIENT'), false);
  assert.equal(canViewParticipantIdentities('TEACHER'), true);
  assert.equal(canViewParticipantIdentities('ADMIN'), true);
  assert.equal(canCancelReservation({ status: 'NO_ASISTE' }), false);
  assert.equal(canCancelReservation({ status: 'CONFIRMADA' }), true);
});

test('serializes only explicit image override changes and allows clearing with null', () => {
  const base = { title: 'Yoga' };
  const changed = withExplicitImageOverride(base, {
    isEditing: true,
    value: 'https://cdn.example.test/new.jpg',
    originalValue: 'https://cdn.example.test/old.jpg'
  });
  assert.deepEqual(changed, { ...base, image_override_url: 'https://cdn.example.test/new.jpg' });
  assert.equal('image_url' in changed, false);
  assert.deepEqual(withExplicitImageOverride(base, {
    isEditing: true,
    value: '',
    originalValue: 'https://cdn.example.test/old.jpg'
  }), { ...base, image_override_url: null });
  assert.deepEqual(withExplicitImageOverride(base, {
    isEditing: true,
    value: '',
    originalValue: ''
  }), base);
  assert.equal(imageOverrideOf({
    effective_image_url: 'https://cdn.example.test/fallback.jpg',
    image_override_url: null
  }), '');
});
