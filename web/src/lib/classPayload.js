const LOCAL_DATE_TIME_PATTERN = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

function parseLocalDateTime(value) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) throw new RangeError(`Invalid local date-time: ${value}`);

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

function formatLocalDateTime(date) {
  const base = [
    pad(date.getFullYear(), 4),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('');
  const millisecond = date.getMilliseconds();
  const second = date.getSeconds();

  if (millisecond !== 0) return `${base}:${pad(second)}.${pad(millisecond, 3)}`;
  if (second !== 0) return `${base}:${pad(second)}`;
  return base;
}

export function instantToLocalDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${value}`);
  return formatLocalDateTime(date);
}

export function localDateTimeToUtcIso(value, originalInstant) {
  const components = parseLocalDateTime(value);
  const date = new Date(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second,
    components.millisecond
  );
  if (components.year >= 0 && components.year <= 99) date.setFullYear(components.year);

  const isExactLocalTime = date.getFullYear() === components.year
    && date.getMonth() === components.month - 1
    && date.getDate() === components.day
    && date.getHours() === components.hour
    && date.getMinutes() === components.minute
    && date.getSeconds() === components.second
    && date.getMilliseconds() === components.millisecond;

  if (!isExactLocalTime) throw new RangeError(`Invalid local date-time: ${value}`);
  if (originalInstant && instantToLocalDateTimeInput(originalInstant) === formatLocalDateTime(date)) {
    return new Date(originalInstant).toISOString();
  }
  return date.toISOString();
}

export function resolveClassTypeId(classTypeId, classTypes = []) {
  const selectedId = Number(classTypeId);
  if (Number.isInteger(selectedId) && selectedId > 0) return selectedId;

  const generalClassType = classTypes.find((type) => type.name?.trim().toLocaleLowerCase('es') === 'general');
  const generalClassTypeId = Number(generalClassType?.id);
  if (Number.isInteger(generalClassTypeId) && generalClassTypeId > 0) return generalClassTypeId;

  throw new RangeError('A concrete class type is required');
}

export function buildClassUpdatePayload(values) {
  const classTypeId = resolveClassTypeId(values.classTypeId, values.classTypes);

  const payload = {
    title: values.title,
    tipo_clase_id: classTypeId,
    teacher_id: values.teacherId ? Number(values.teacherId) : undefined,
    max_capacity: Number(values.maxCapacity),
    start_time: localDateTimeToUtcIso(values.startTime, values.originalStartTime),
    end_time: localDateTimeToUtcIso(values.endTime, values.originalEndTime)
  };

  if (values.imageOverrideDirty === true) {
    const explicitImageOverride = values.imageOverrideUrl?.trim();
    payload.image_override_url = explicitImageOverride || null;
  }

  return payload;
}

export function selectedClassById(classes, selectedClassId) {
  if (selectedClassId === null || selectedClassId === undefined) return null;
  return classes.find((gymClass) => gymClass.id === selectedClassId) ?? null;
}
