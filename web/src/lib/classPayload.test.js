import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  buildClassCreatePayload,
  buildClassUpdatePayload,
  instantToLocalDateTimeInput,
  selectedClassById
} from './classPayload.js';

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

const createFormValues = {
  title: 'Yoga suave',
  classTypeId: '3',
  maxCapacity: '12',
  startTime: '2026-08-18T10:00',
  endTime: '2026-08-18T11:00'
};

test('omits the per-class image override when another field is edited', () => {
  const payload = buildClassUpdatePayload(formValues);
  assert.equal('image_override_url' in payload, false);
  assert.equal('imageUrl' in payload, false);
  assert.equal('image_url' in payload, false);
  assert.equal('effectiveImageUrl' in payload, false);
  assert.equal('imageOverrideUrl' in payload, false);
});

test('includes weekly repetition, assigned teacher and deduplicated fixed users on create', () => {
  const payload = buildClassCreatePayload({
    ...createFormValues,
    teacherId: '8',
    repeatWeeks: '6',
    fixedUserIds: [11, '12', 11]
  });

  assert.equal(payload.teacher_id, 8);
  assert.equal(payload.repeat_weeks, 6);
  assert.deepEqual(payload.fixed_user_ids, [11, 12]);
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

function buildPayload(flow, overrides = {}) {
  if (flow === 'create') {
    return buildClassCreatePayload({ ...createFormValues, ...overrides });
  }
  return buildClassUpdatePayload({ ...formValues, ...overrides });
}

test('converts exact valid Europe/Madrid wall-clock times in create and edit payloads', () => {
  for (const flow of ['create', 'edit']) {
    const springBoundary = buildPayload(flow, {
      startTime: '2026-03-29T01:59:59.999',
      endTime: '2026-03-29T03:00'
    });
    assert.equal(springBoundary.start_time, '2026-03-29T00:59:59.999Z');
    assert.equal(springBoundary.end_time, '2026-03-29T01:00:00.000Z');

    const autumnBoundary = buildPayload(flow, {
      startTime: '2026-10-25T01:59:59.999',
      endTime: '2026-10-25T03:00'
    });
    assert.equal(autumnBoundary.start_time, '2026-10-24T23:59:59.999Z');
    assert.equal(autumnBoundary.end_time, '2026-10-25T02:00:00.000Z');
  }
});

test('rejects the Europe/Madrid spring DST gap in create and edit payloads', () => {
  for (const flow of ['create', 'edit']) {
    assert.throws(
      () => buildPayload(flow, {
        startTime: '2026-03-29T02:30',
        endTime: '2026-03-29T04:00'
      }),
      {
        name: 'RangeError',
        message: 'La fecha y hora seleccionadas no existen por el cambio de horario en Europe/Madrid.'
      }
    );
  }
});

test('fails closed for the Europe/Madrid autumn DST overlap in create and edit payloads', () => {
  for (const flow of ['create', 'edit']) {
    assert.throws(
      () => buildPayload(flow, {
        startTime: '2026-10-25T02:30',
        endTime: '2026-10-25T04:00'
      }),
      {
        name: 'RangeError',
        message: 'La fecha y hora seleccionadas son ambiguas por el cambio de horario en Europe/Madrid.'
      }
    );
  }
});

test('requires end to be after start in create and edit payloads', () => {
  for (const flow of ['create', 'edit']) {
    assert.throws(
      () => buildPayload(flow, {
        startTime: '2026-08-18T10:00',
        endTime: '2026-08-18T10:00'
      }),
      {
        name: 'RangeError',
        message: 'La hora de fin debe ser posterior a la hora de inicio.'
      }
    );
  }
});

test('formats edit inputs in Europe/Madrid regardless of the process timezone', () => {
  const script = `
    import { instantToLocalDateTimeInput } from './src/lib/classPayload.js';
    console.log(JSON.stringify([
      instantToLocalDateTimeInput('2026-01-15T08:30:45.123Z'),
      instantToLocalDateTimeInput('2026-07-15T08:30:45.123Z')
    ]));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TZ: 'America/New_York' }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    '2026-01-15T09:30:45.123',
    '2026-07-15T10:30:45.123'
  ]);
});

test('maps unambiguous Europe/Madrid instants back to the same wall-clock value', () => {
  assert.equal(instantToLocalDateTimeInput('2026-03-29T00:59:59.999Z'), '2026-03-29T01:59:59.999');
  assert.equal(instantToLocalDateTimeInput('2026-03-29T01:00:00.000Z'), '2026-03-29T03:00');
  assert.equal(instantToLocalDateTimeInput('2026-10-25T02:00:00.000Z'), '2026-10-25T03:00');
});
