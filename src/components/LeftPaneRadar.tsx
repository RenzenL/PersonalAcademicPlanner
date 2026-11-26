import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, ClassSchedule, Course } from '../types/academic';
import { calculateAnchorReadiness } from '../engines/readinessEngine';
import { evaluateCourseStudyFreshness } from '../engines/loadAdvisorEngine';
import {
  diffDays,
  formatMonthYear,
  formatShortDate,
  getMonthCalendarGrid,
  getTodayDateKey,
  toDateKey,
} from '../utils/dateUtils';
import { ActionIcon, Checkbox, Dot } from './ui';

interface LeftPaneRadarProps {
  onEditCourse: (course: Course) => void;
  onOpenNewCourse: () => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
  onOpenNewAnchor: () => void;
  onOpenNewClass: () => void;
  onEditClass: (cls: ClassSchedule) => void;
  onOpenNewStudyLog: (defaultCourseId?: string) => void;
}

const MINI_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const LeftPaneRadar: React.FC<LeftPaneRadarProps> = ({
  onEditCourse,
  onOpenNewCourse,
  onEditAnchor,
  onOpenNewAnchor,
  onOpenNewClass,
  onEditClass,
  onOpenNewStudyLog,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const srCards = useAcademicStore((s) => s.srCards);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const studyLogs = useAcademicStore((s) => s.studyLogs);
  const addStudyLog = useAcademicStore((s) => s.addStudyLog);
  const updateStudyLog = useAcademicStore((s) => s.updateStudyLog);
  const deleteStudyLog = useAcademicStore((s) => s.deleteStudyLog);
  const calendarMonthDate = useAcademicStore((s) => s.calendarMonthDate);
  const selectedCalendarDate = useAcademicStore((s) => s.selectedCalendarDate);
  const inspectedLogDate = useAcademicStore((s) => s.inspectedLogDate);
  const setInspectedLogDate = useAcademicStore((s) => s.setInspectedLogDate);
  const selectedCourseFilter = useAcademicStore((s) => s.selectedCourseFilter);
  const selectedAnchorTypeFilter = useAcademicStore((s) => s.selectedAnchorTypeFilter);
  const navigateCalendarMonth = useAcademicStore((s) => s.navigateCalendarMonth);
  const setSelectedCalendarDate = useAcademicStore((s) => s.setSelectedCalendarDate);
  const setSelectedCourseFilter = useAcademicStore((s) => s.setSelectedCourseFilter);
  const setSelectedAnchorTypeFilter = useAcademicStore((s) => s.setSelectedAnchorTypeFilter);
  const deleteCourse = useAcademicStore((s) => s.deleteCourse);
  const toggleAnchorCompleted = useAcademicStore((s) => s.toggleAnchorCompleted);
  const deleteAnchorEvent = useAcademicStore((s) => s.deleteAnchorEvent);
  const loadSampleTemplate = useAcademicStore((s) => s.loadSampleTemplate);

  const [showMiniCal, setShowMiniCal] = useState(true);
  const [recentLog, setRecentLog] = useState<{ id: string; code: string } | null>(null);
  const [recentNote, setRecentNote] = useState('');

  const todayKey = getTodayDateKey();
  const miniGrid = getMonthCalendarGrid(calendarMonthDate, todayKey);

  const freshnessList = evaluateCourseStudyFreshness(courses, studyLogs, taskBlocks, todayKey);
  const neglectedCourses = freshnessList.filter((f) => f.isNeglected);

  const handleQuickLogCourse = (course: Course) => {
    const created = addStudyLog({
      courseId: course.id,
      date: todayKey,
      minutes: 45,
      notes: '',
      type: 'STUDY',
    });
    setRecentLog({ id: created.id, code: course.code });
    setRecentNote('');
  };

  const handleSaveRecentNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recentLog) return;
    if (recentNote.trim()) {
      updateStudyLog(recentLog.id, { notes: recentNote.trim() });
    }
    setRecentLog(null);
    setRecentNote('');
  };

  const anchors = anchorEvents
    .filter(
      (a) =>
        (selectedCourseFilter === 'ALL' || a.courseId === selectedCourseFilter) &&
        (selectedAnchorTypeFilter === 'ALL' || a.type === selectedAnchorTypeFilter)
    )
    .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate)));

  const upcoming = anchors.filter((a) => !a.completed && diffDays(todayKey, a.dueDate) >= 0);
  const pastOrDone = anchors.filter((a) => a.completed || diffDays(todayKey, a.dueDate) < 0);

  const renderAnchor = (anchor: AnchorEvent) => {
    const course = courses.find((c) => c.id === anchor.courseId);
    const days = diffDays(todayKey, anchor.dueDate);
    const readiness = calculateAnchorReadiness(anchor, taskBlocks, srCards);
    const overdue = days < 0 && !anchor.completed;
    const countdown = anchor.completed
      ? 'done'
      : overdue
      ? `${Math.abs(days)}d ago`
      : days === 0
      ? 'today'
      : `${days} day${days === 1 ? '' : 's'}`;

    return (
      <div
        key={anchor.id}
        onClick={() => onEditAnchor(anchor)}
        className={`card card-glow group p-3 cursor-pointer ${
          anchor.completed ? 'opacity-50' : ''
        } ${overdue ? '!border-danger/50' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Checkbox
            size="sm"
            checked={anchor.completed}
            onToggle={() => toggleAnchorCompleted(anchor.id)}
          />
          <Dot color={course?.colorHex} />
          <span
            className={`font-mono text-xs font-semibold uppercase tracking-wide truncate ${
              anchor.completed ? 'line-through text-subtle' : 'text-fg'
            }`}
          >
            {anchor.type === 'ASSIGNMENT' ? 'Assignment' : anchor.type}
          </span>
          <div className="ml-auto flex items-center opacity-60 group-hover:opacity-100 transition-opacity">
            <ActionIcon title="Edit" onClick={() => onEditAnchor(anchor)}>
              <Pencil className="w-3 h-3" />
            </ActionIcon>
            <ActionIcon title="Delete" danger onClick={() => deleteAnchorEvent(anchor.id)}>
              <Trash2 className="w-3 h-3" />
            </ActionIcon>
          </div>
        </div>

        <p className="mt-1.5 text-xs text-fg/90 leading-snug line-clamp-2">{anchor.title}</p>

        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
          <span>
            {course?.code || '—'} · {formatShortDate(anchor.dueDate)} · {anchor.weightage}%
          </span>
          <span className={overdue ? 'text-danger' : days <= 3 && !anchor.completed ? 'text-warn' : ''}>
            {countdown}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-elev overflow-hidden">
            <div
              className="h-full rounded-full bg-fg transition-all duration-300"
              style={{ width: `${readiness.readinessPercent}%` }}
            />
          </div>
          <span
            className="font-mono text-[10px] text-muted w-8 text-right"
            title={`Tasks ${readiness.completedTasksCount}/${readiness.totalTasksCount} · SR mastery ${Math.round(
              readiness.srMasteryAverage * 100
            )}%`}
          >
            {readiness.readinessPercent}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-[290px] shrink-0 h-full flex flex-col gap-3 p-4 pr-2 select-none">
      {/* ACADEMIC RADAR */}
      <div className="flex items-center justify-between px-0.5">
        <span className="section-label">Academic Radar</span>
        <button onClick={onOpenNewAnchor} className="pill hover:text-fg hover:border-line-strong">
          <Plus className="w-3 h-3" /> deadline
        </button>
      </div>

      <div className="panel flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* Mini calendar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <button
              onClick={() => setShowMiniCal(!showMiniCal)}
              className="flex items-center gap-1 text-xs font-medium text-fg"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted transition-transform ${showMiniCal ? '' : '-rotate-90'}`}
              />
              {formatMonthYear(calendarMonthDate)}
            </button>
            <div className="flex items-center">
              <button onClick={() => navigateCalendarMonth(-1)} className="icon-btn">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => navigateCalendarMonth(1)} className="icon-btn">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showMiniCal && (
            <div>
              <div className="grid grid-cols-7 text-center mb-1">
                {MINI_WEEKDAYS.map((w, i) => (
                  <span key={i} className="font-mono text-[10px] text-subtle">
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {miniGrid.map((cell) => {
                  const hasDeadline = anchorEvents.some((a) => toDateKey(a.dueDate) === cell.dateStr);
                  const hasTasks = taskBlocks.some((t) => t.scheduledDate === cell.dateStr);
                  const hasLogs = studyLogs.some((l) => toDateKey(l.date) === cell.dateStr);
                  const selected = cell.dateStr === selectedCalendarDate;
                  return (
                    <button
                      key={cell.dateStr}
                      onClick={() => {
                        setSelectedCalendarDate(cell.dateStr);
                        setInspectedLogDate(cell.dateStr);
                      }}
                      title={hasLogs ? 'Click to see logs for this day' : 'Select day'}
                      className={`relative h-7 rounded-md font-mono text-[11px] transition-colors ${
                        cell.isToday
                          ? 'bg-fg text-app font-semibold'
                          : selected
                          ? 'ring-1 ring-line-strong text-fg bg-elev'
                          : cell.isCurrentMonth
                          ? 'text-fg/80 hover:bg-elev'
                          : 'text-subtle/60 hover:bg-elev'
                      }`}
                    >
                      {cell.dayNumber}
                      {(hasDeadline || hasTasks || hasLogs) && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {hasDeadline && <span className="w-1 h-1 rounded-full bg-danger" />}
                          {hasLogs && <span className="w-1 h-1 rounded-full bg-info" />}
                          {hasTasks && (
                            <span className={`w-1 h-1 rounded-full ${cell.isToday ? 'bg-app' : 'bg-muted'}`} />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Inspected Day Logs Bubble (under calendar on Academic Radar) */}
        {inspectedLogDate && (
          <div className="rounded-lg border border-info/40 bg-elev/60 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold text-fg flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5 text-info shrink-0" />
                Logs · {inspectedLogDate === todayKey ? 'Today' : formatShortDate(inspectedLogDate)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpenNewStudyLog()}
                  className="font-mono text-[10px] text-info hover:underline"
                >
                  + Add
                </button>
                <button
                  onClick={() => setInspectedLogDate(null)}
                  className="icon-btn"
                  title="Close day logs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            {(() => {
              const dayLogs = studyLogs.filter(
                (l) => toDateKey(l.date) === inspectedLogDate
              );
              if (dayLogs.length === 0) {
                return (
                  <p className="text-[11px] text-muted">
                    No study or completion logs recorded on this day.
                  </p>
                );
              }
              const totalMins = dayLogs.reduce((s, l) => s + l.minutes, 0);
              return (
                <div className="space-y-1.5">
                  <div className="font-mono text-[10px] text-muted">
                    {dayLogs.length} {dayLogs.length === 1 ? 'entry' : 'entries'} · {totalMins}m total
                  </div>
                  {dayLogs.map((log) => {
                    const c = log.courseId
                      ? courses.find((cr) => cr.id === log.courseId)
                      : undefined;
                    return (
                      <div
                        key={log.id}
                        className="group flex items-start justify-between gap-1.5 text-[11px] border-t border-line/60 pt-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Dot color={c?.colorHex} className="!w-1.5 !h-1.5 shrink-0" />
                            <span className="font-mono font-medium text-fg truncate">
                              {c ? c.code : log.customTopic || 'Activity'}
                            </span>
                            <span className="font-mono text-[10px] text-subtle">
                              {log.minutes}m
                            </span>
                          </div>
                          {log.notes && (
                            <p className="text-muted text-[11px] leading-snug pl-3 mt-0.5">
                              {log.notes}
                            </p>
                          )}
                        </div>
                        <ActionIcon
                          title="Delete log"
                          danger
                          onClick={() => deleteStudyLog(log.id)}
                        >
                          <Trash2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                        </ActionIcon>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Courses */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Courses</span>
            <button onClick={onOpenNewCourse} className="icon-btn" title="Add course">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {courses.length === 0 ? (
            <div className="flex gap-1.5">
              <button onClick={onOpenNewCourse} className="dashed-add flex-1">
                + Create first course
              </button>
              <button
                onClick={loadSampleTemplate}
                className="btn !px-2.5"
                title="Load a sample CS/AI workspace"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCourseFilter('ALL')}
                className={`px-2 py-1 rounded-md font-mono text-[11px] border transition-colors ${
                  selectedCourseFilter === 'ALL'
                    ? 'bg-fg text-app border-fg'
                    : 'border-line text-muted hover:text-fg'
                }`}
              >
                ALL
              </button>
              {courses.map((course) => {
                const active = selectedCourseFilter === course.id;
                return (
                  <div
                    key={course.id}
                    onClick={() => setSelectedCourseFilter(active ? 'ALL' : course.id)}
                    title={course.name}
                    className={`group inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[11px] border cursor-pointer transition-colors ${
                      active ? 'border-line-strong bg-elev text-fg' : 'border-line text-muted hover:text-fg'
                    }`}
                  >
                    <Dot color={course.colorHex} className="!w-1.5 !h-1.5" />
                    {course.code}
                    {course.syllabus && course.syllabus.length > 0 && (
                      <span className="text-[9px] text-subtle">
                        {course.syllabus.filter((s) => s.completed).length}/{course.syllabus.length}
                      </span>
                    )}
                    <span className="hidden group-hover:inline-flex items-center -mr-1">
                      <ActionIcon title="Edit course & syllabus" onClick={() => onEditCourse(course)}>
                        <Pencil className="w-2.5 h-2.5" />
                      </ActionIcon>
                      <ActionIcon title="Delete course" danger onClick={() => deleteCourse(course.id)}>
                        <Trash2 className="w-2.5 h-2.5" />
                      </ActionIcon>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 1-Click Study Log + Outside Curriculum */}
        {courses.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Quick log today
              </span>
              <button
                onClick={() => onOpenNewStudyLog()}
                className="font-mono text-[10px] text-muted hover:text-fg transition-colors"
                title="Log a topic outside your registered courses"
              >
                + Outside
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {courses.map((c) => {
                const loggedToday = studyLogs.some(
                  (l) => l.courseId === c.id && l.date === todayKey
                );
                return (
                  <button
                    key={c.id}
                    onClick={() => handleQuickLogCourse(c)}
                    title={`Click to log 45m study for ${c.code} today`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] border transition-colors ${
                      loggedToday
                        ? 'border-success/50 bg-success/10 text-success'
                        : 'border-line text-muted hover:text-fg hover:border-line-strong'
                    }`}
                  >
                    {loggedToday ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : (
                      <Dot color={c.colorHex} className="!w-1.5 !h-1.5" />
                    )}
                    {c.code}
                  </button>
                );
              })}
            </div>

            {recentLog && (
              <form onSubmit={handleSaveRecentNote} className="flex gap-1 pt-0.5">
                <input
                  value={recentNote}
                  onChange={(e) => setRecentNote(e.target.value)}
                  placeholder={`Logged ${recentLog.code}! Optional note (Enter)...`}
                  autoFocus
                  className="input !py-1 !text-[11px] flex-1"
                />
                <button type="submit" className="btn !py-1 !px-2 !text-[10px]">
                  Save
                </button>
              </form>
            )}
          </div>
        )}

        {/* Neglected Subject Auto-Reminders (> 7 days) */}
        {neglectedCourses.length > 0 && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-warn">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Neglected (&gt;7d unstudied)</span>
            </div>
            <div className="space-y-1">
              {neglectedCourses.map((f) => (
                <div
                  key={f.course.id}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Dot color={f.course.colorHex} className="!w-1.5 !h-1.5" />
                    <span className="font-mono text-fg truncate">{f.course.code}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {f.daysSinceStudied !== null ? `${f.daysSinceStudied}d ago` : 'never'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleQuickLogCourse(f.course)}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-panel border border-line text-fg hover:border-line-strong shrink-0"
                  >
                    Log Today
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Recurring Classes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> Weekly classes
            </span>
            <button onClick={onOpenNewClass} className="icon-btn" title="Add weekly class">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {classSchedules.length === 0 ? (
            <button onClick={onOpenNewClass} className="dashed-add !py-1.5 !text-[11px]">
              + Add repeating class
            </button>
          ) : (
            <div className="flex flex-wrap gap-1">
              {classSchedules.map((cls) => {
                const course = courses.find((c) => c.id === cls.courseId);
                return (
                  <button
                    key={cls.id}
                    onClick={() => onEditClass(cls)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-line text-[10px] font-mono text-muted hover:text-fg hover:border-line-strong transition-colors"
                    title={`${cls.title} (${cls.startTime}–${cls.endTime})`}
                  >
                    <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
                    <span className="truncate max-w-[110px]">{cls.title}</span>
                    <span className="text-subtle">{cls.startTime}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Type filter */}
        <div className="seg w-full justify-between">
          {(['ALL', 'QUIZ', 'MINOR', 'MAJOR', 'ASSIGNMENT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedAnchorTypeFilter(t)}
              className={`seg-item !px-1.5 font-mono !text-[10px] uppercase ${
                selectedAnchorTypeFilter === t ? 'is-active' : ''
              }`}
            >
              {t === 'ASSIGNMENT' ? 'assign' : t.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Countdown — upcoming */}
        <div className="space-y-2">
          <span className="text-xs text-muted">Countdown · upcoming</span>
          {upcoming.length === 0 ? (
            <button onClick={onOpenNewAnchor} className="dashed-add">
              + Add exam / deadline
            </button>
          ) : (
            upcoming.map(renderAnchor)
          )}
        </div>

        {pastOrDone.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted">Completed / past</span>
            {pastOrDone.map(renderAnchor)}
          </div>
        )}
      </div>
    </aside>
  );
};
