import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  Plus,
  ScrollText,
  Target,
  Trash2,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, TaskBlock } from '../types/academic';
import { evaluateCourseStudyFreshness } from '../engines/loadAdvisorEngine';
import { diffDays, formatShortDate, getTodayDateKey, toDateKey } from '../utils/dateUtils';
import { ActionIcon, Checkbox, Dot } from './ui';

interface RightPaneProps {
  onOpenNewStudyLog: (defaultCourseId?: string) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
  onEditTask: (task: TaskBlock) => void;
}

type LowerTab = 'BACKLOG' | 'UPCOMING' | 'LOGS';

export const RightPaneSRQueue: React.FC<RightPaneProps> = ({
  onOpenNewStudyLog,
  onEditAnchor,
  onEditTask,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const studyLogs = useAcademicStore((s) => s.studyLogs);
  const isRightPaneCollapsed = useAcademicStore((s) => s.isRightPaneCollapsed);
  const addStudyLog = useAcademicStore((s) => s.addStudyLog);
  const deleteStudyLog = useAcademicStore((s) => s.deleteStudyLog);
  const toggleAnchorCompleted = useAcademicStore((s) => s.toggleAnchorCompleted);
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);

  const [lowerTab, setLowerTab] = useState<LowerTab>('BACKLOG');
  const todayKey = getTodayDateKey();

  // 1. Subjects Studied — ranked by most recently studied on top
  const rankedSubjects = useMemo(() => {
    const freshness = evaluateCourseStudyFreshness(
      courses,
      studyLogs,
      taskBlocks,
      todayKey
    );

    type SubjectRow = {
      key: string;
      courseId?: string;
      label: string;
      sublabel: string;
      colorHex?: string;
      lastStudiedDate: string | null;
      daysSince: number | null;
      totalMinutes: number;
      isNeglected: boolean;
      isOutside: boolean;
    };

    const rows: SubjectRow[] = freshness.map((f) => ({
      key: f.course.id,
      courseId: f.course.id,
      label: f.course.code,
      sublabel: f.course.name,
      colorHex: f.course.colorHex,
      lastStudiedDate: f.lastStudiedDate,
      daysSince: f.daysSinceStudied,
      totalMinutes: f.totalMinutesLogged,
      isNeglected: f.isNeglected,
      isOutside: false,
    }));

    // Also include outside-curriculum topics from studyLogs
    const outsideMap = new Map<
      string,
      { lastDate: string; totalMinutes: number }
    >();
    for (const log of studyLogs) {
      if (log.courseId || !log.customTopic) continue;
      const existing = outsideMap.get(log.customTopic);
      const d = toDateKey(log.date);
      if (!existing) {
        outsideMap.set(log.customTopic, { lastDate: d, totalMinutes: log.minutes });
      } else {
        outsideMap.set(log.customTopic, {
          lastDate: d > existing.lastDate ? d : existing.lastDate,
          totalMinutes: existing.totalMinutes + log.minutes,
        });
      }
    }

    for (const [topic, info] of outsideMap.entries()) {
      rows.push({
        key: `outside:${topic}`,
        label: topic,
        sublabel: 'Outside curriculum',
        lastStudiedDate: info.lastDate,
        daysSince: Math.max(0, diffDays(info.lastDate, todayKey)),
        totalMinutes: info.totalMinutes,
        isNeglected: false,
        isOutside: true,
      });
    }

    return rows.sort((a, b) => {
      if (a.lastStudiedDate && b.lastStudiedDate) {
        return b.lastStudiedDate.localeCompare(a.lastStudiedDate);
      }
      if (a.lastStudiedDate) return -1;
      if (b.lastStudiedDate) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [courses, studyLogs, taskBlocks, todayKey]);

  // 2. Auto-Backlog: any incomplete AnchorEvent or TaskBlock past its due/scheduled date
  const overdueAnchors = useMemo(
    () =>
      anchorEvents
        .filter((a) => !a.completed && diffDays(todayKey, a.dueDate) < 0)
        .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate))),
    [anchorEvents, todayKey]
  );

  const overdueTasks = useMemo(
    () =>
      taskBlocks
        .filter(
          (t) =>
            t.status !== 'DONE' &&
            !t.isBuffer &&
            t.scheduledDate !== null &&
            diffDays(todayKey, t.scheduledDate) < 0
        )
        .sort((a, b) =>
          (a.scheduledDate || '').localeCompare(b.scheduledDate || '')
        ),
    [taskBlocks, todayKey]
  );

  const backlogCount = overdueAnchors.length + overdueTasks.length;

  // 3. Upcoming Events
  const upcomingAnchors = useMemo(
    () =>
      anchorEvents
        .filter((a) => !a.completed && diffDays(todayKey, a.dueDate) >= 0)
        .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate))),
    [anchorEvents, todayKey]
  );

  // 4. Unified Logs grouped by date (one bubble per day, newest day first)
  const groupedLogsByDay = useMemo(() => {
    const groups = new Map<string, typeof studyLogs>();
    for (const log of studyLogs) {
      const dateKey = toDateKey(log.date);
      const list = groups.get(dateKey) || [];
      list.push(log);
      groups.set(dateKey, list);
    }
    return Array.from(groups.entries()).sort(([d1], [d2]) =>
      d2.localeCompare(d1)
    );
  }, [studyLogs]);

  if (isRightPaneCollapsed) return null;

  return (
    <aside className="w-[300px] shrink-0 h-full flex flex-col gap-3 p-4 pl-2 select-none">
      {/* TOP: SUBJECTS STUDIED (RANKED BY MOST RECENT) */}
      <div className="flex items-center justify-between px-0.5">
        <span className="section-label">Subjects Studied</span>
        <button
          onClick={() => onOpenNewStudyLog()}
          className="pill hover:text-fg hover:border-line-strong"
        >
          <Plus className="w-3 h-3" /> log
        </button>
      </div>

      <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
          {rankedSubjects.length === 0 ? (
            <div className="h-full min-h-[80px] flex flex-col items-center justify-center text-center px-3 gap-2">
              <BookOpen className="w-5 h-5 text-subtle" />
              <p className="text-xs text-muted">
                No subjects logged yet. Click a course or + Log to track what you studied.
              </p>
            </div>
          ) : (
            rankedSubjects.map((subj) => {
              const recencyLabel =
                subj.daysSince === null
                  ? 'never'
                  : subj.daysSince === 0
                  ? 'today'
                  : `${subj.daysSince}d ago`;
              return (
                <div
                  key={subj.key}
                  className={`card px-2.5 py-2 flex items-center justify-between gap-2 ${
                    subj.isNeglected ? '!border-warn/50 bg-warn/5' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Dot color={subj.colorHex} className="!w-1.5 !h-1.5" />
                      <span className="font-mono text-[11px] font-semibold text-fg truncate">
                        {subj.label}
                      </span>
                      {subj.isNeglected && (
                        <span title="Not studied for >7 days" className="inline-flex shrink-0">
                          <AlertTriangle className="w-3 h-3 text-warn" />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted">
                      <span
                        className={
                          subj.daysSince === 0
                            ? 'text-success font-medium'
                            : subj.isNeglected
                            ? 'text-warn'
                            : ''
                        }
                      >
                        {recencyLabel}
                      </span>
                      {subj.totalMinutes > 0 && (
                        <span>· {subj.totalMinutes}m logged</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      subj.courseId
                        ? addStudyLog({
                            courseId: subj.courseId,
                            date: todayKey,
                            minutes: 45,
                            type: 'STUDY',
                          })
                        : onOpenNewStudyLog()
                    }
                    className="pill hover:text-fg hover:border-line-strong shrink-0"
                    title="Log 45m study today"
                  >
                    {subj.daysSince === 0 ? (
                      <Check className="w-2.5 h-2.5 text-success" />
                    ) : (
                      <Plus className="w-2.5 h-2.5" />
                    )}
                    Log
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* BOTTOM: UPCOMING EVENTS & AUTO-BACKLOG & DAY LOGS */}
      <div className="panel h-[50%] min-h-[240px] flex flex-col overflow-hidden">
        <div className="p-2 border-b border-line shrink-0">
          <div className="seg w-full">
            <button
              onClick={() => setLowerTab('BACKLOG')}
              className={`seg-item flex-1 ${lowerTab === 'BACKLOG' ? 'is-active' : ''}`}
            >
              Backlog
              {backlogCount > 0 && (
                <span className="ml-1 font-mono text-[10px] px-1 rounded bg-danger/20 text-danger">
                  {backlogCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setLowerTab('UPCOMING')}
              className={`seg-item flex-1 ${lowerTab === 'UPCOMING' ? 'is-active' : ''}`}
            >
              Upcoming ({upcomingAnchors.length})
            </button>
            <button
              onClick={() => setLowerTab('LOGS')}
              className={`seg-item flex-1 ${lowerTab === 'LOGS' ? 'is-active' : ''}`}
            >
              Logs ({groupedLogsByDay.length})
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
          {lowerTab === 'BACKLOG' && (
            <>
              {backlogCount === 0 ? (
                <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-muted text-center px-3">
                  No overdue items. Incomplete tasks and events past their due date appear here automatically.
                </div>
              ) : (
                <>
                  {overdueAnchors.map((anchor) => {
                    const course = courses.find((c) => c.id === anchor.courseId);
                    const daysOver = Math.abs(diffDays(todayKey, anchor.dueDate));
                    return (
                      <div
                        key={anchor.id}
                        onClick={() => onEditAnchor(anchor)}
                        className="card p-2.5 cursor-pointer !border-danger/40 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            size="sm"
                            checked={anchor.completed}
                            onToggle={() => toggleAnchorCompleted(anchor.id)}
                          />
                          <Target className="w-3 h-3 text-danger shrink-0" />
                          <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
                          <span className="text-xs font-medium text-fg truncate flex-1">
                            {anchor.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted pl-6">
                          <span>
                            {course?.code || anchor.type} · {formatShortDate(anchor.dueDate)}
                          </span>
                          <span className="text-danger">{daysOver}d overdue</span>
                        </div>
                      </div>
                    );
                  })}

                  {overdueTasks.map((task) => {
                    const course = courses.find((c) => c.id === task.courseId);
                    const daysOver = Math.abs(
                      diffDays(todayKey, task.scheduledDate || todayKey)
                    );
                    return (
                      <div
                        key={task.id}
                        onClick={() => onEditTask(task)}
                        className="card p-2.5 cursor-pointer space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            size="sm"
                            checked={task.status === 'DONE'}
                            onToggle={() => toggleTaskStatus(task.id)}
                          />
                          <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
                          <span className="text-xs text-fg truncate flex-1">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] text-muted pl-6">
                          <span>
                            {course?.code || 'TASK'} ·{' '}
                            {formatShortDate(task.scheduledDate || todayKey)}
                          </span>
                          <span className="text-warn">{daysOver}d overdue</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

          {lowerTab === 'UPCOMING' && (
            <>
              {upcomingAnchors.length === 0 ? (
                <div className="h-full min-h-[80px] flex items-center justify-center text-xs text-muted">
                  No upcoming events.
                </div>
              ) : (
                upcomingAnchors.map((anchor) => {
                  const course = courses.find((c) => c.id === anchor.courseId);
                  const days = diffDays(todayKey, anchor.dueDate);
                  return (
                    <div
                      key={anchor.id}
                      onClick={() => onEditAnchor(anchor)}
                      className="card p-2.5 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          size="sm"
                          checked={anchor.completed}
                          onToggle={() => toggleAnchorCompleted(anchor.id)}
                        />
                        <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
                        <span className="font-mono text-[10px] uppercase text-muted shrink-0">
                          {anchor.type}
                        </span>
                        <span className="text-xs text-fg truncate flex-1">
                          {anchor.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-muted pl-6">
                        <span>
                          {course?.code || '—'} · {formatShortDate(anchor.dueDate)}
                        </span>
                        <span className={days <= 3 ? 'text-warn' : ''}>
                          {days === 0 ? 'today' : `${days}d`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {lowerTab === 'LOGS' && (
            <>
              <button
                onClick={() => onOpenNewStudyLog()}
                className="dashed-add !py-1.5 !text-[11px]"
              >
                + Log study / activity
              </button>
              {groupedLogsByDay.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  No logs yet. Completing tasks, deadlines, or clicking a course logs here grouped by day.
                </div>
              ) : (
                groupedLogsByDay.map(([dateKey, dayLogs]) => {
                  const totalMins = dayLogs.reduce((s, l) => s + l.minutes, 0);
                  return (
                    <div
                      key={dateKey}
                      className="card p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-line pb-1.5">
                        <span className="font-mono text-[11px] font-semibold text-fg flex items-center gap-1.5">
                          <ScrollText className="w-3 h-3 text-info" />
                          {dateKey === todayKey ? 'Today' : formatShortDate(dateKey)}
                          <span className="text-subtle font-normal">({dateKey})</span>
                        </span>
                        <span className="font-mono text-[10px] text-muted flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {totalMins}m
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {dayLogs.map((log) => {
                          const course = log.courseId
                            ? courses.find((c) => c.id === log.courseId)
                            : undefined;
                          return (
                            <div
                              key={log.id}
                              className="group flex items-start justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Dot
                                    color={course?.colorHex}
                                    className="!w-1.5 !h-1.5 shrink-0"
                                  />
                                  <span className="font-mono font-medium text-fg truncate">
                                    {course ? course.code : log.customTopic || 'Activity'}
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
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
