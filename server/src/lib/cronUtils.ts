/**
 * cronUtils
 * Lightweight cron parsing and next-run calculation with timezone support.
 */

interface CronScheduleFields {
  minutes: Set<number>;
  hours: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
}

interface ZonedParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const key = timezone.toLowerCase();
  const existing = formatterCache.get(key);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    minute: 'numeric',
    hour: 'numeric',
    day: 'numeric',
    month: 'numeric'
  });

  formatterCache.set(key, formatter);
  return formatter;
}

function normalizeTimezone(timezone: string | undefined): string {
  if (!timezone || timezone.trim().length === 0) {
    return 'UTC';
  }

  const candidate = timezone.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (_error) {
    return 'UTC';
  }
}

function range(min: number, max: number): number[] {
  const values: number[] = [];
  for (let i = min; i <= max; i += 1) {
    values.push(i);
  }
  return values;
}

function parseTokenRange(token: string, min: number, max: number, normalizeDayOfWeek: boolean): number[] {
  const cleaned = token.trim().toLowerCase();
  if (cleaned.length === 0) {
    throw new Error('Invalid empty cron token');
  }

  const [basePart, stepPart] = cleaned.split('/');
  const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
  if (!Number.isInteger(step) || step <= 0) {
    throw new Error(`Invalid cron step value: ${token}`);
  }

  let start = min;
  let end = max;

  if (basePart !== '*') {
    const [rawStart, rawEnd] = basePart.split('-');
    start = Number.parseInt(rawStart, 10);
    end = rawEnd ? Number.parseInt(rawEnd, 10) : start;

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`Invalid cron range value: ${token}`);
    }
  }

  if (normalizeDayOfWeek) {
    if (start === 7) {
      start = 0;
    }
    if (end === 7) {
      end = 0;
    }

    if (start === 0 && end === 0 && basePart.includes('7')) {
      return [0];
    }

    if (start > end && end === 0) {
      const values: number[] = [];
      for (let value = start; value <= 6; value += step) {
        values.push(value);
      }
      values.push(0);
      return values;
    }
  }

  if (start < min || start > max || end < min || end > max || start > end) {
    throw new Error(`Cron value out of range: ${token}`);
  }

  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }

  return values;
}

function parseField(
  field: string,
  min: number,
  max: number,
  normalizeDayOfWeek: boolean = false
): Set<number> {
  const output = new Set<number>();
  const segments = field.split(',').map((segment) => segment.trim()).filter(Boolean);

  if (segments.length === 0) {
    throw new Error('Invalid cron field');
  }

  for (const segment of segments) {
    const values = parseTokenRange(segment, min, max, normalizeDayOfWeek);
    for (const value of values) {
      output.add(normalizeDayOfWeek && value === 7 ? 0 : value);
    }
  }

  return output;
}

function parseCronExpression(cronExpression: string): CronScheduleFields {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron expression must contain 5 fields');
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = parts;

  return {
    minutes: parseField(minuteField, 0, 59),
    hours: parseField(hourField, 0, 23),
    dayOfMonth: parseField(dayOfMonthField, 1, 31),
    month: parseField(monthField, 1, 12),
    dayOfWeek: parseField(dayOfWeekField, 0, 7, true)
  };
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = getFormatter(timezone);
  const formattedParts = formatter.formatToParts(date);

  const minute = Number.parseInt(formattedParts.find((part) => part.type === 'minute')?.value ?? '0', 10);
  const hour = Number.parseInt(formattedParts.find((part) => part.type === 'hour')?.value ?? '0', 10);
  const dayOfMonth = Number.parseInt(formattedParts.find((part) => part.type === 'day')?.value ?? '1', 10);
  const month = Number.parseInt(formattedParts.find((part) => part.type === 'month')?.value ?? '1', 10);
  const weekdayRaw = (formattedParts.find((part) => part.type === 'weekday')?.value ?? 'sun').toLowerCase().slice(0, 3);
  const dayOfWeek = WEEKDAY_TO_INDEX[weekdayRaw] ?? 0;

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek
  };
}

function matchesSchedule(fields: CronScheduleFields, parts: ZonedParts): boolean {
  return fields.minutes.has(parts.minute)
    && fields.hours.has(parts.hour)
    && fields.dayOfMonth.has(parts.dayOfMonth)
    && fields.month.has(parts.month)
    && fields.dayOfWeek.has(parts.dayOfWeek);
}

export function validateCronExpression(cronExpression: string): { valid: boolean; error?: string } {
  try {
    parseCronExpression(cronExpression);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid cron expression'
    };
  }
}

export function getNextRunAt(
  cronExpression: string,
  timezone: string,
  fromDate: Date = new Date(),
  maxLookaheadMinutes: number = 60 * 24 * 366
): Date | null {
  const fields = parseCronExpression(cronExpression);
  const normalizedTimezone = normalizeTimezone(timezone);

  const startAt = new Date(fromDate.getTime());
  startAt.setSeconds(0, 0);
  startAt.setMinutes(startAt.getMinutes() + 1);

  const startMs = startAt.getTime();

  for (let offset = 0; offset <= maxLookaheadMinutes; offset += 1) {
    const candidate = new Date(startMs + (offset * 60_000));
    const parts = getZonedParts(candidate, normalizedTimezone);
    if (matchesSchedule(fields, parts)) {
      return candidate;
    }
  }

  return null;
}

export function estimateRetryAt(fromDate: Date, retryBackoffSeconds: number, attemptCount: number): Date {
  const factor = Math.max(1, Math.pow(2, Math.max(0, attemptCount - 1)));
  const delayMs = Math.max(1, retryBackoffSeconds) * 1000 * factor;
  return new Date(fromDate.getTime() + delayMs);
}

export function normalizeScheduleTimezone(timezone: string | undefined): string {
  return normalizeTimezone(timezone);
}

export function expandAllValuesForField(min: number, max: number): number[] {
  return range(min, max);
}
