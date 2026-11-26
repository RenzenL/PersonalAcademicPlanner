/**
 * Date helper utilities operating consistently on YYYY-MM-DD local date strings
 * for the Notion Calendar view, 7-day board, and deadline countdowns.
 */

export function toDateKey(dateInput: Date | string): string {
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
      return dateInput.slice(0, 10);
    }
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
      return formatDateLocal(parsed);
    }
    return dateInput;
  }
  return formatDateLocal(dateInput);
}

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const clean = toDateKey(dateStr);
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateLocal(dt);
}

export function addMonths(dateStr: string, monthsDelta: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(1);
  dt.setMonth(dt.getMonth() + monthsDelta);
  return formatDateLocal(dt);
}

export function diffDays(fromDateStr: string, toDateStr: string): number {
  const d1 = parseLocalDate(fromDateStr);
  const d2 = parseLocalDate(toDateStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}

export function getTodayDateKey(): string {
  return formatDateLocal(new Date());
}

export function formatShortDate(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonthYear(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  return dt.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDayHeader(dateStr: string, todayStr: string): {
  weekday: string;
  monthDay: string;
  relativeLabel: string | null;
  isToday: boolean;
  isPast: boolean;
} {
  const dt = parseLocalDate(dateStr);
  const diff = diffDays(todayStr, dateStr);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let relativeLabel: string | null = null;
  if (diff === 0) relativeLabel = 'Today';
  else if (diff === 1) relativeLabel = 'Tomorrow';
  else if (diff === -1) relativeLabel = 'Yesterday';
  else if (diff > 1) relativeLabel = `in ${diff}d`;
  else if (diff < -1) relativeLabel = `${Math.abs(diff)}d ago`;

  return {
    weekday,
    monthDay,
    relativeLabel,
    isToday: diff === 0,
    isPast: diff < 0,
  };
}

export function getRollingDays(startDateStr: string, count = 7): string[] {
  return Array.from({ length: count }, (_, idx) => addDays(startDateStr, idx));
}

export interface CalendarGridCell {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

/**
 * Generates a 42-cell (6 weeks x 7 days, Sunday-Saturday) calendar grid
 * for the month containing `anchorDateStr`.
 */
export function getMonthCalendarGrid(
  anchorDateStr: string,
  todayStr = getTodayDateKey()
): CalendarGridCell[] {
  const anchor = parseLocalDate(anchorDateStr);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

  const gridStartDate = new Date(year, month, 1 - startDayOfWeek, 12, 0, 0, 0);
  const cells: CalendarGridCell[] = [];

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStartDate);
    cellDate.setDate(gridStartDate.getDate() + i);
    const dateStr = formatDateLocal(cellDate);
    cells.push({
      dateStr,
      dayNumber: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month,
      isToday: dateStr === todayStr,
      isPast: diffDays(todayStr, dateStr) < 0,
    });
  }

  return cells;
}
