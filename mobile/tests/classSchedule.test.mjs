import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClassSchedule,
  instantToClassDateTimeInput,
  localClassDateTimeToUtcIso
} from '../src/utils/classSchedule.js';

test('converts exact valid Europe/Madrid wall-clock boundary times to UTC', () => {
  const springBoundary = buildClassSchedule(
    '2026-03-29T01:59:59.999',
    '2026-03-29T03:00'
  );
  assert.equal(springBoundary.start_time, '2026-03-29T00:59:59.999Z');
  assert.equal(springBoundary.end_time, '2026-03-29T01:00:00.000Z');

  const autumnBoundary = buildClassSchedule(
    '2026-10-25T01:59:59.999',
    '2026-10-25T03:00'
  );
  assert.equal(autumnBoundary.start_time, '2026-10-24T23:59:59.999Z');
  assert.equal(autumnBoundary.end_time, '2026-10-25T02:00:00.000Z');
});

test('rejects the Europe/Madrid spring DST gap', () => {
  assert.throws(
    () => buildClassSchedule('2026-03-29T02:30', '2026-03-29T04:00'),
    {
      name: 'RangeError',
      message: 'La fecha y hora seleccionadas no existen por el cambio de horario en Europe/Madrid.'
    }
  );
});

test('fails closed for the Europe/Madrid autumn DST overlap', () => {
  assert.throws(
    () => buildClassSchedule('2026-10-25T02:30', '2026-10-25T04:00'),
    {
      name: 'RangeError',
      message: 'La fecha y hora seleccionadas son ambiguas por el cambio de horario en Europe/Madrid.'
    }
  );
});

test('rejects invalid datetime-local values without native Date normalization', () => {
  for (const value of ['', '2026-02-29T10:00', '2026-04-31T10:00', '2026-08-18T24:00', '2026-08-18 10:00', '2026-08-18T10:00Z']) {
    assert.throws(
      () => localClassDateTimeToUtcIso(value),
      {
        name: 'RangeError',
        message: 'La fecha y hora seleccionadas no son válidas en Europe/Madrid.'
      }
    );
  }
});

test('requires class end to be after start', () => {
  for (const end of ['2026-08-18T10:00', '2026-08-18T09:59:59.999']) {
    assert.throws(
      () => buildClassSchedule('2026-08-18T10:00', end),
      {
        name: 'RangeError',
        message: 'La hora de fin debe ser posterior a la hora de inicio.'
      }
    );
  }
});

test('formats edit inputs explicitly in Europe/Madrid across standard and daylight time', () => {
  const originalTimeZone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(instantToClassDateTimeInput('2026-01-15T08:30:45.123Z'), '2026-01-15T09:30:45.123');
    assert.equal(instantToClassDateTimeInput('2026-07-15T08:30:45.123Z'), '2026-07-15T10:30:45.123');
    assert.equal(instantToClassDateTimeInput('2026-03-29T00:59:59.999Z'), '2026-03-29T01:59:59.999');
    assert.equal(instantToClassDateTimeInput('2026-03-29T01:00:00.000Z'), '2026-03-29T03:00');
    assert.equal(instantToClassDateTimeInput('2026-10-25T02:00:00.000Z'), '2026-10-25T03:00');
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});
