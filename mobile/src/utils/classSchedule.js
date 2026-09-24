const LOCAL_DATE_TIME_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export const CLASS_TIME_ZONE = 'Europe/Madrid';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const OFFSET_SAMPLE_DAYS = [-2, -1, 0, 1, 2];
const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
  timeZone: CLASS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const INVALID_LOCAL_DATE_TIME_MESSAGE = `La fecha y hora seleccionadas no son válidas en ${CLASS_TIME_ZONE}.`;
const NONEXISTENT_LOCAL_DATE_TIME_MESSAGE = `La fecha y hora seleccionadas no existen por el cambio de horario en ${CLASS_TIME_ZONE}.`;
const AMBIGUOUS_LOCAL_DATE_TIME_MESSAGE = `La fecha y hora seleccionadas son ambiguas por el cambio de horario en ${CLASS_TIME_ZONE}.`;
const INVALID_CLASS_RANGE_MESSAGE = 'La hora de fin debe ser posterior a la hora de inicio.';

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

function parseLocalDateTime(value) {
  if (typeof value !== 'string') throw new RangeError(INVALID_LOCAL_DATE_TIME_MESSAGE);

  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) throw new RangeError(INVALID_LOCAL_DATE_TIME_MESSAGE);

  const [, year, month, day, hour, minute, second = '0', fraction = ''] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(fraction.padEnd(3, '0'))
  };
}

function formatLocalDateTime(components) {
  const base = [
    pad(components.year, 4),
    '-',
    pad(components.month),
    '-',
    pad(components.day),
    'T',
    pad(components.hour),
    ':',
    pad(components.minute)
  ].join('');

  if (components.millisecond !== 0) {
    return `${base}:${pad(components.second)}.${pad(components.millisecond, 3)}`;
  }
  if (components.second !== 0) return `${base}:${pad(components.second)}`;
  return base;
}

function utcTimestampFromComponents(components) {
  const date = new Date(0);
  date.setUTCFullYear(components.year, components.month - 1, components.day);
  date.setUTCHours(
    components.hour,
    components.minute,
    components.second,
    components.millisecond
  );
  return date.getTime();
}

function utcComponentsFromDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds()
  };
}

function localComponentsFromInstant(date) {
  const components = {};
  for (const part of LOCAL_DATE_TIME_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') components[part.type] = Number(part.value);
  }
  return {
    year: components.year,
    month: components.month,
    day: components.day,
    hour: components.hour,
    minute: components.minute,
    second: components.second,
    millisecond: date.getUTCMilliseconds()
  };
}

function sameDateTime(left, right) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second
    && left.millisecond === right.millisecond;
}

function zoneOffsetAt(timestamp) {
  const instant = new Date(timestamp);
  return utcTimestampFromComponents(localComponentsFromInstant(instant)) - timestamp;
}

function possibleInstantsForLocalDateTime(components) {
  const wallClockTimestamp = utcTimestampFromComponents(components);
  const wallClockDate = new Date(wallClockTimestamp);
  if (!Number.isFinite(wallClockTimestamp) || !sameDateTime(components, utcComponentsFromDate(wallClockDate))) {
    throw new RangeError(INVALID_LOCAL_DATE_TIME_MESSAGE);
  }

  const offsets = new Set(
    OFFSET_SAMPLE_DAYS.map((day) => zoneOffsetAt(wallClockTimestamp + day * DAY_IN_MILLISECONDS))
  );
  const candidates = new Set();
  for (const offset of offsets) {
    const candidate = wallClockTimestamp - offset;
    if (sameDateTime(components, localComponentsFromInstant(new Date(candidate)))) {
      candidates.add(candidate);
    }
  }
  return [...candidates].sort((left, right) => left - right);
}

function localDateTimeTimestamp(value) {
  const candidates = possibleInstantsForLocalDateTime(parseLocalDateTime(value));
  if (candidates.length === 0) throw new RangeError(NONEXISTENT_LOCAL_DATE_TIME_MESSAGE);
  if (candidates.length > 1) throw new RangeError(AMBIGUOUS_LOCAL_DATE_TIME_MESSAGE);
  return candidates[0];
}

export function instantToClassDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(INVALID_LOCAL_DATE_TIME_MESSAGE);
  return formatLocalDateTime(localComponentsFromInstant(date));
}

export function localClassDateTimeToUtcIso(value) {
  return new Date(localDateTimeTimestamp(value)).toISOString();
}

export function buildClassSchedule(startValue, endValue) {
  const startTimestamp = localDateTimeTimestamp(startValue);
  const endTimestamp = localDateTimeTimestamp(endValue);
  if (endTimestamp <= startTimestamp) throw new RangeError(INVALID_CLASS_RANGE_MESSAGE);

  return {
    start_time: new Date(startTimestamp).toISOString(),
    end_time: new Date(endTimestamp).toISOString()
  };
}
