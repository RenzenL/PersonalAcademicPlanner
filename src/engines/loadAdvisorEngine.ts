import {
  AnchorEvent,
  ClassSchedule,
  Course,
  StudyLog,
  TaskBlock,
} from '../types/academic';
import { addDays, diffDays, formatShortDate, parseLocalDate, toDateKey } from '../utils/dateUtils';

export interface CourseStudyFreshness {
  course: Course;
  lastStudiedDate: string | null;
  daysSinceStudied: number | null; // null if never studied
  isNeglected: boolean; // true if > 7 days since last study (or never studied)
  totalLogsCount: number;
  totalMinutesLogged: number;
  syllabusCompleted: number;
  syllabusTotal: number;
}

export interface DayLoadForecast {
  dateStr: string;
  classMinutes: number;
  taskMinutes: number;
  combinedMinutes: number;
  capacityMinutes: number;
  loadRatio: number;
  isHeavy: boolean; // >= 0.85 * capacity
  isOverloaded: boolean; // > capacity
  classes: ClassSchedule[];
}

export interface LoadAdvisory {
  id: string;
  severity: 'HIGH' | 'MEDIUM';
  title: string;
  detail: string;
  heavyDate: string;
  suggestedDate?: string;
  suggestedTaskId?: string;
}

/**
 * Computes duration in minutes between "HH:MM" start and end times.
 */
export function getClassDurationMinutes(cls: ClassSchedule): number {
  const [sh, sm] = cls.startTime.split(':').map(Number);
  const [eh, em] = cls.endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 60;
  const diff = eh * 60 + em - (sh * 60 + sm);
  return Math.max(15, diff);
}

/**
 * Returns all recurring weekly classes occurring on a given YYYY-MM-DD date,
 * respecting repeatUntil and single-instance reschedules, sorted by startTime.
 */
export function getClassesForDate(
  dateStr: string,
  classSchedules: ClassSchedule[]
): ClassSchedule[] {
  const dayKey = toDateKey(dateStr);
  const dayOfWeek = parseLocalDate(dayKey).getDay(); // 0=Sun..6=Sat
  return classSchedules
    .filter((c) => {
      // Strictly enforce repeatUntil end date first so decreasing repeatUntil immediately removes all later blocks
      if (c.repeatUntil && dayKey > toDateKey(c.repeatUntil)) return false;

      // Skip single occurrences deleted via drag-to-trash
      if ((c.deletedInstances || []).includes(dayKey)) return false;

      const resched = c.rescheduledInstances || {};
      // If a valid (non-expired) instance was moved TO this date, show it
      const movedHere = Object.entries(resched).some(
        ([orig, target]) =>
          toDateKey(target) === dayKey &&
          (!c.repeatUntil || toDateKey(orig) <= toDateKey(c.repeatUntil))
      );
      if (movedHere) return true;

      // If this date's occurrence was moved away, don't show it here
      if (resched[dayKey]) return false;

      return c.daysOfWeek.includes(dayOfWeek);
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Given a visible dateStr for a class instance, returns the original occurrence date
 * (in case it was already rescheduled once) so subsequent drags update the same key.
 */
export function getClassInstanceOriginDate(
  visibleDateStr: string,
  cls: ClassSchedule
): string {
  const resched = cls.rescheduledInstances || {};
  const found = Object.entries(resched).find(([, target]) => target === visibleDateStr);
  return found ? found[0] : visibleDateStr;
}

/**
 * Evaluates study freshness for each registered course and flags any course
 * not studied for longer than 7 days.
 */
export function evaluateCourseStudyFreshness(
  courses: Course[],
  studyLogs: StudyLog[],
  taskBlocks: TaskBlock[],
  todayKey: string
): CourseStudyFreshness[] {
  return courses.map((course) => {
    const courseLogs = studyLogs.filter((l) => l.courseId === course.id);
    const completedTasks = taskBlocks.filter(
      (t) => t.courseId === course.id && t.status === 'DONE' && t.scheduledDate
    );

    const candidateDates: string[] = [
      ...courseLogs.map((l) => toDateKey(l.date)),
      ...completedTasks.map((t) => toDateKey(t.scheduledDate!)),
    ].sort();

    const lastStudiedDate =
      candidateDates.length > 0 ? candidateDates[candidateDates.length - 1] : null;

    const daysSinceStudied = lastStudiedDate
      ? Math.max(0, diffDays(lastStudiedDate, todayKey))
      : null;

    // Neglected if > 7 days since last study, OR never studied and created > 7 days ago
    // (Also if never studied at all and there are logs/tasks in the app, or createdAt missing,
    // we flag > 7 days explicitly, and if never studied we mark isNeglected = true after 0 days if user wants reminder,
    // or strictly > 7 days when studied/created. Let's check: if never studied, if createdAt is >7d ago OR no createdAt -> warn!)
    let isNeglected = false;
    if (daysSinceStudied !== null) {
      isNeglected = daysSinceStudied > 7;
    } else if (course.createdAt) {
      isNeglected = diffDays(course.createdAt, todayKey) > 7;
    } else {
      // Newly created course without createdAt yet: don't immediately alarm on day 0
      isNeglected = false;
    }

    const totalMinutesLogged = courseLogs.reduce((s, l) => s + l.minutes, 0);
    const syllabus = course.syllabus || [];
    const syllabusCompleted = syllabus.filter((s) => s.completed).length;

    return {
      course,
      lastStudiedDate,
      daysSinceStudied,
      isNeglected,
      totalLogsCount: courseLogs.length,
      totalMinutesLogged,
      syllabusCompleted,
      syllabusTotal: syllabus.length,
    };
  });
}

/**
 * Predicts daily load across the next 14 days (classes + scheduled tasks)
 * and generates proactive workload advisories.
 */
export function analyzePredictiveLoad(params: {
  todayKey: string;
  taskBlocks: TaskBlock[];
  classSchedules: ClassSchedule[];
  anchorEvents: AnchorEvent[];
  dailyCapacityMinutes: number;
}): {
  forecasts: DayLoadForecast[];
  advisories: LoadAdvisory[];
} {
  const {
    todayKey,
    taskBlocks,
    classSchedules,
    anchorEvents,
    dailyCapacityMinutes,
  } = params;

  const forecasts: DayLoadForecast[] = [];
  const horizonDays = 14;

  for (let i = 0; i < horizonDays; i++) {
    const dateStr = addDays(todayKey, i);
    const classes = getClassesForDate(dateStr, classSchedules);
    const classMinutes = classes.reduce(
      (sum, c) => sum + getClassDurationMinutes(c),
      0
    );

    // Weight class time at 0.5x against study capacity (or count full combined load)
    // We report both raw classMinutes + taskMinutes and compare combined load against capacity + 120m buffer
    const dayTasks = taskBlocks.filter(
      (t) => t.scheduledDate === dateStr && t.status !== 'DONE'
    );
    const taskMinutes = dayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

    // Effective pressure: tasks + 60% of class schedule time (since classes consume energy/daylight)
    const effectiveLoad = taskMinutes + Math.round(classMinutes * 0.6);
    const loadRatio =
      dailyCapacityMinutes > 0 ? effectiveLoad / dailyCapacityMinutes : 0;

    forecasts.push({
      dateStr,
      classMinutes,
      taskMinutes,
      combinedMinutes: taskMinutes + classMinutes,
      capacityMinutes: dailyCapacityMinutes,
      loadRatio,
      isHeavy: loadRatio >= 0.85,
      isOverloaded: loadRatio > 1.0,
      classes,
    });
  }

  const advisories: LoadAdvisory[] = [];

  // 1. Detect upcoming heavy/overloaded days and find an earlier lighter day to pull tasks forward
  const heavyDays = forecasts.filter((f) => f.isHeavy && f.taskMinutes > 0);
  for (const heavy of heavyDays) {
    // Find an earlier day (starting from today) with at least 60m headroom
    const lighterDay = forecasts.find(
      (f) =>
        diffDays(f.dateStr, heavy.dateStr) > 0 &&
        f.loadRatio < 0.7 &&
        dailyCapacityMinutes - (f.taskMinutes + Math.round(f.classMinutes * 0.6)) >= 60
    );

    const movableTask = taskBlocks.find(
      (t) =>
        t.scheduledDate === heavy.dateStr &&
        t.status !== 'DONE' &&
        !t.isBuffer &&
        !t.dependencyId
    );

    const classHours = (heavy.classMinutes / 60).toFixed(1);
    const taskHours = (heavy.taskMinutes / 60).toFixed(1);

    advisories.push({
      id: `adv-heavy-${heavy.dateStr}`,
      severity: heavy.isOverloaded ? 'HIGH' : 'MEDIUM',
      title: `Heavy load predicted on ${formatShortDate(heavy.dateStr)}`,
      detail: `${taskHours}h study + ${classHours}h classes scheduled.${
        lighterDay && movableTask
          ? ` Pull "${movableTask.title}" (${movableTask.estimatedMinutes}m) forward to ${formatShortDate(
              lighterDay.dateStr
            )} to balance your week.`
          : ' Consider splitting or shifting non-urgent blocks.'
      }`,
      heavyDate: heavy.dateStr,
      suggestedDate: lighterDay?.dateStr,
      suggestedTaskId: movableTask?.id,
    });
  }

  // 2. Detect upcoming deadlines within 5 days that have heavy days right before them or incomplete prep
  const upcomingExams = anchorEvents.filter((a) => {
    if (a.completed) return false;
    const d = diffDays(todayKey, a.dueDate);
    return d >= 0 && d <= 5;
  });

  for (const exam of upcomingExams) {
    const incompleteLinked = taskBlocks.filter(
      (t) => t.anchorId === exam.id && t.status !== 'DONE' && !t.isBuffer
    );
    const remainingMins = incompleteLinked.reduce(
      (s, t) => s + t.estimatedMinutes,
      0
    );
    const daysLeft = diffDays(todayKey, exam.dueDate);

    // Check if tomorrow or day before exam is heavy
    const heavyBeforeExam = forecasts.some(
      (f) =>
        diffDays(todayKey, f.dateStr) >= 0 &&
        diffDays(f.dateStr, toDateKey(exam.dueDate)) >= 0 &&
        f.isHeavy
    );

    if (remainingMins >= 120 && (daysLeft <= 3 || heavyBeforeExam)) {
      advisories.push({
        id: `adv-exam-${exam.id}`,
        severity: daysLeft <= 2 ? 'HIGH' : 'MEDIUM',
        title: `${exam.title} in ${daysLeft === 0 ? 'today' : `${daysLeft}d`}`,
        detail: `${(remainingMins / 60).toFixed(1)}h of linked prep (${
          incompleteLinked.length
        } blocks) still pending${
          heavyBeforeExam ? ' alongside a heavy class/study schedule' : ''
        }. Start chipping away today.`,
        heavyDate: toDateKey(exam.dueDate),
      });
    }
  }

  return {
    forecasts,
    advisories: advisories.slice(0, 4),
  };
}
