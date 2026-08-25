import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildClassUpdatePayload, selectedClassById } from './classPayload.js';

const formValues = {
  title: 'Yoga suave',
  classTypeId: '3',
  teacherId: '8',
  maxCapacity: '12',
  startTime: '2026-08-18T10:00',
  endTime: '2026-08-18T11:00',
  imageUrl: 'https://cdn.example.test/effective-fallback.jpg',
  effectiveImageUrl: 'https://cdn.example.test/effective-fallback.jpg',
  imageOverrideUrl: 'https://cdn.example.test/stored-override.jpg',
  imageOverrideDirty: false
};

test('omits the per-class image override when another field is edited', () => {
  const payload = buildClassUpdatePayload(formValues);
  assert.equal('image_override_url' in payload, false);
  assert.equal('imageUrl' in payload, false);
  assert.equal('image_url' in payload, false);
  assert.equal('effectiveImageUrl' in payload, false);
  assert.equal('imageOverrideUrl' in payload, false);
});

test('sends a trimmed per-class image override after an explicit edit', () => {
  const payload = buildClassUpdatePayload({
    ...formValues,
    imageOverrideUrl: '  https://cdn.example.test/new-override.jpg  ',
    imageOverrideDirty: true
  });
  assert.equal(payload.image_override_url, 'https://cdn.example.test/new-override.jpg');
});

test('sends null after explicitly clearing the per-class image override', () => {
  const payload = buildClassUpdatePayload({
    ...formValues,
    imageOverrideUrl: '   ',
    imageOverrideDirty: true
  });
  assert.equal(payload.image_override_url, null);
  assert.equal('imageUrl' in payload, false);
  assert.equal('image_url' in payload, false);
});

test('omits a realtime image value that was not edited in the modal', () => {
  const payload = buildClassUpdatePayload({
    ...formValues,
    imageOverrideUrl: 'https://cdn.example.test/concurrent-update.jpg',
    imageOverrideDirty: false
  });
  assert.equal('image_override_url' in payload, false);
});

test('sends the concrete General class type id instead of omitting it', () => {
  const payload = buildClassUpdatePayload({
    ...formValues,
    classTypeId: '',
    classTypes: [{ id: 7, name: 'General' }]
  });

  assert.equal(payload.tipo_clase_id, 7);
  assert.equal(JSON.parse(JSON.stringify(payload)).tipo_clase_id, 7);
});

test('rejects a missing class type instead of silently preserving the previous one', () => {
  assert.throws(
    () => buildClassUpdatePayload({ ...formValues, classTypeId: '' }),
    { name: 'RangeError', message: 'A concrete class type is required' }
  );
});

test('reconciles an open class with refreshed capacity and participants by id', () => {
  const refreshedReservation = { id: 91, status: 'CONFIRMADA', user: { id: 12, name: 'Ada' } };
  const refreshedClasses = [{
    id: 42,
    max_capacity: 18,
    _count: { reservations: 1 },
    reservations: [refreshedReservation]
  }];

  const selectedClass = selectedClassById(refreshedClasses, 42);

  assert.strictEqual(selectedClass, refreshedClasses[0]);
  assert.equal(selectedClass.max_capacity, 18);
  assert.equal(selectedClass._count.reservations, 1);
  assert.deepEqual(selectedClass.reservations, [refreshedReservation]);
  assert.equal(selectedClassById(refreshedClasses, 99), null);
});

function runTimezoneScenario(timeZone, instants, editedLocalTime, invalidLocalTime, invalidOriginalInstant) {
  const script = `
    import { buildClassUpdatePayload, instantToLocalDateTimeInput } from './src/lib/classPayload.js';

    const values = {
      title: 'Yoga suave',
      classTypeId: '3',
      teacherId: '8',
      maxCapacity: '12'
    };
    const roundTrips = ${JSON.stringify(instants)}.map((instant) => {
      const localDateTime = instantToLocalDateTimeInput(instant);
      const payload = buildClassUpdatePayload({
        ...values,
        startTime: localDateTime,
        endTime: localDateTime,
        originalStartTime: instant,
        originalEndTime: instant
      });
      return { instant, localDateTime, payloadInstant: payload.start_time };
    });
    const editedPayload = buildClassUpdatePayload({
      ...values,
      startTime: ${JSON.stringify(editedLocalTime)},
      endTime: ${JSON.stringify(editedLocalTime)}
    });
    let invalidLocalTimeError = null;
    try {
      buildClassUpdatePayload({
        ...values,
        startTime: ${JSON.stringify(invalidLocalTime)},
        endTime: ${JSON.stringify(invalidLocalTime)},
        originalStartTime: ${JSON.stringify(invalidOriginalInstant)},
        originalEndTime: ${JSON.stringify(invalidOriginalInstant)}
      });
    } catch (error) {
      invalidLocalTimeError = error.name;
    }
    console.log(JSON.stringify({ roundTrips, editedInstant: editedPayload.start_time, invalidLocalTimeError }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TZ: timeZone }
  });

  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('uses Europe/Madrid local components and preserves exact instants across DST changes', () => {
  const instants = [
    '2026-01-15T08:30:45.123Z',
    '2026-07-15T08:30:45.123Z',
    '2026-03-29T00:30:00.000Z',
    '2026-03-29T01:30:00.000Z',
    '2026-10-25T00:30:00.000Z',
    '2026-10-25T01:30:00.000Z'
  ];
  const result = runTimezoneScenario(
    'Europe/Madrid',
    instants,
    '2026-07-15T10:30:45.123',
    '2026-03-29T02:30',
    '2026-03-29T01:30:00.000Z'
  );

  assert.deepEqual(result.roundTrips.map(({ localDateTime }) => localDateTime), [
    '2026-01-15T09:30:45.123',
    '2026-07-15T10:30:45.123',
    '2026-03-29T01:30',
    '2026-03-29T03:30',
    '2026-10-25T02:30',
    '2026-10-25T02:30'
  ]);
  assert.deepEqual(result.roundTrips.map(({ payloadInstant }) => payloadInstant), instants);
  assert.equal(result.editedInstant, '2026-07-15T08:30:45.123Z');
  assert.equal(result.invalidLocalTimeError, 'RangeError');
});

test('converts through local components in another timezone', () => {
  const instants = [
    '2026-01-15T08:30:45.123Z',
    '2026-07-15T08:30:45.123Z'
  ];
  const result = runTimezoneScenario(
    'America/New_York',
    instants,
    '2026-07-15T04:30:45.123',
    '2026-03-08T02:30',
    '2026-03-08T07:30:00.000Z'
  );

  assert.deepEqual(result.roundTrips.map(({ localDateTime }) => localDateTime), [
    '2026-01-15T03:30:45.123',
    '2026-07-15T04:30:45.123'
  ]);
  assert.deepEqual(result.roundTrips.map(({ payloadInstant }) => payloadInstant), instants);
  assert.equal(result.editedInstant, '2026-07-15T08:30:45.123Z');
  assert.equal(result.invalidLocalTimeError, 'RangeError');
});
