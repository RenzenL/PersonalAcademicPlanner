import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Sparkles,
  Target,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, ClassSchedule, Course, TaskBlock, TimeSlot } from '../types/academic';
import {
  formatMonthYear,
  getRollingDays,
  getTodayDateKey,
  parseLocalDate,
  toDateKey,
} from '../utils/dateUtils';
import { evaluateDayDiagnostics } from '../engines/rippleEngine';
import {
  analyzePredictiveLoad,
  getClassDurationMinutes,
  getClassesForDate,
} from '../engines/loadAdvisorEngine';
import { TaskBlockCard } from './TaskBlockCard';
import { NotionCalendarView, NotionDatabaseTableView } from './NotionCalendarAndTable';
import { ActionIcon, Dot, formatHours } from './ui';

interface CenterPaneTimelineProps {
  onEditTask: (task: TaskBlock) => void;
  onQuickAddTaskAt: (dateStr: string, slot: TimeSlot) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
  onEditClass: (cls: ClassSchedule) => void;
  onOpenNewTask: () => void;
}

const SLOTS: { slot: TimeSlot; label: string }[] = [
  { slot: 'MORNING', label: 'Morning' },
  { slot: 'AFTERNOON', label: 'Afternoon' },
  { slot: 'EVENING', label: 'Evening' },
];

const formatColumnDate = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const mo = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${wd} ${d.getDate()} ${mo}`;
};

/* ---------------------------------------------------------------------------
 * Inline "+ Add task" — dashed button that turns into an input
 * ------------------------------------------------------------------------- */
export const InlineAdd: React.FC<{ onCreate: (title: string) => void; label?: string }> = ({
  onCreate,
  label = '+ Add task',
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="dashed-add">
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onCreate(value.trim());
        setValue('');
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim()) onCreate(value.trim());
          setValue('');
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        placeholder="Task title, Enter to add…"
        className="input !py-2"
      />
    </form>
  );
};

/* ---------------------------------------------------------------------------
 * Swimlane (droppable)
 * ------------------------------------------------------------------------- */
interface SwimlaneProps {
  dateStr: string;
  slot: TimeSlot;
  label: string;
  tasks: TaskBlock[];
  courses: Course[];
  allTasks: TaskBlock[];
  allAnchors: AnchorEvent[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEditTask: (task: TaskBlock) => void;
  onCreate: (title: string) => void;
}

const Swimlane: React.FC<SwimlaneProps> = ({
  dateStr,
  slot,
  label,
  tasks,
  courses,
  allTasks,
  allAnchors,
  collapsed,
  onToggleCollapse,
  onEditTask,
  onCreate,
}) => {
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);
  const toggleTaskBuffer = useAcademicStore((s) => s.toggleTaskBuffer);
  const toggleTaskLock = useAcademicStore((s) => s.toggleTaskLock);
  const deleteTaskBlock = useAcademicStore((s) => s.deleteTaskBlock);
  const shiftSingleTaskWithCascade = useAcademicStore((s) => s.shiftSingleTaskWithCascade);

  const { setNodeRef, isOver } = useDroppable({
    id: `container:${dateStr}:${slot}`,
    data: { type: 'CONTAINER', scheduledDate: dateStr, timeSlot: slot },
  });

  const minutes = tasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  return (
    <div
      ref={setNodeRef}
      className={`border-t border-line px-2.5 pt-2 pb-2.5 transition-colors ${isOver ? 'bg-elev' : ''}`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between mb-2 group"
      >
        <span className="section-label group-hover:text-fg transition-colors">
          {label}
          {tasks.length > 0 && <span className="ml-1.5 text-subtle">{tasks.length}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {minutes > 0 && <span className="font-mono text-[10px] text-subtle">{minutes}m</span>}
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-2">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskBlockCard
                key={task.id}
                task={task}
                course={courses.find((c) => c.id === task.courseId)}
                linkedAnchor={allAnchors.find((a) => a.id === task.anchorId)}
                allTasks={allTasks}
                allAnchors={allAnchors}
                onToggleDone={toggleTaskStatus}
                onToggleBuffer={toggleTaskBuffer}
                onToggleLock={toggleTaskLock}
                onEditTask={onEditTask}
                onDeleteTask={deleteTaskBlock}
                onShiftTaskCascade={(id) => shiftSingleTaskWithCascade(id, 1)}
              />
            ))}
          </SortableContext>
          <InlineAdd onCreate={onCreate} />
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Draggable Class & Anchor cards (modular + lockable)
 * ------------------------------------------------------------------------- */
const DraggableClassCard: React.FC<{
  cls: ClassSchedule;
  dateStr: string;
  course?: Course;
  onEdit: (cls: ClassSchedule) => void;
  onToggleLock: (id: string) => void;
}> = ({ cls, dateStr, course, onEdit, onToggleLock }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `class:${cls.id}:${dateStr}`,
    data: { type: 'CLASS_INSTANCE', cls, origDate: dateStr },
    disabled: Boolean(cls.isLocked),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(cls)}
      className={`group flex items-center gap-1.5 px-2 py-1 rounded-md bg-elev/70 border border-line hover:border-line-strong ${
        cls.isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-30' : ''}`}
      title={`Recurring class · ${cls.startTime}–${cls.endTime}${cls.location ? ` · ${cls.location}` : ''}`}
    >
      <CalendarClock className="w-3 h-3 text-info shrink-0" />
      <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
      <span className="text-[11px] text-fg truncate flex-1">{cls.title}</span>
      {cls.isLocked && <Lock className="w-2.5 h-2.5 text-warn shrink-0" />}
      <span className="hidden group-hover:flex -my-1">
        <ActionIcon
          title={cls.isLocked ? 'Unlock' : 'Lock (un-draggable)'}
          onClick={() => onToggleLock(cls.id)}
        >
          {cls.isLocked ? <Lock className="w-2.5 h-2.5 text-warn" /> : <Unlock className="w-2.5 h-2.5" />}
        </ActionIcon>
      </span>
      <span className="font-mono text-[10px] text-muted shrink-0">{cls.startTime}</span>
    </div>
  );
};

const DraggableAnchorCard: React.FC<{
  anchor: AnchorEvent;
  course?: Course;
  onEdit: (anchor: AnchorEvent) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
}> = ({ anchor, course, onEdit, onDelete, onToggleLock }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `anchor:${anchor.id}`,
    data: { type: 'ANCHOR_EVENT', anchor },
    disabled: Boolean(anchor.isLocked),
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(anchor)}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-elev border border-line hover:border-line-strong ${
        anchor.isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-30' : ''}`}
      title="Quiz / Exam / Assignment — drag to reschedule or lock to pin"
    >
      <Target className="w-3 h-3 text-danger shrink-0" />
      <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
      <span className="mono-tag text-muted shrink-0">{anchor.type}</span>
      <span className="text-[11px] text-fg truncate flex-1">{anchor.title}</span>
      {anchor.isLocked && <Lock className="w-2.5 h-2.5 text-warn shrink-0 group-hover:hidden" />}
      <span className="hidden group-hover:flex -my-1">
        <ActionIcon
          title={anchor.isLocked ? 'Unlock' : 'Lock (un-draggable)'}
          onClick={() => onToggleLock(anchor.id)}
        >
          {anchor.isLocked ? <Lock className="w-2.5 h-2.5 text-warn" /> : <Unlock className="w-2.5 h-2.5" />}
        </ActionIcon>
        <ActionIcon title="Edit" onClick={() => onEdit(anchor)}>
          <Pencil className="w-2.5 h-2.5" />
        </ActionIcon>
        <ActionIcon title="Delete" danger onClick={() => onDelete(anchor.id)}>
          <Trash2 className="w-2.5 h-2.5" />
        </ActionIcon>
      </span>
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Center pane
 * ------------------------------------------------------------------------- */
export const CenterPaneTimeline: React.FC<CenterPaneTimelineProps> = ({
  onEditTask,
  onQuickAddTaskAt,
  onEditAnchor,
  onEditClass,
  onOpenNewTask,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const workspaceView = useAcademicStore((s) => s.workspaceView);
  const setWorkspaceView = useAcademicStore((s) => s.setWorkspaceView);
  const dailyCapacityMinutes = useAcademicStore((s) => s.dailyCapacityMinutes);
  const timelineStartDate = useAcademicStore((s) => s.timelineStartDate);
  const calendarMonthDate = useAcademicStore((s) => s.calendarMonthDate);
  const selectedCourseFilter = useAcademicStore((s) => s.selectedCourseFilter);
  const lastRippleLog = useAcademicStore((s) => s.lastRippleLog);
  const navigateTimeline = useAcademicStore((s) => s.navigateTimeline);
  const navigateCalendarMonth = useAcademicStore((s) => s.navigateCalendarMonth);
  const jumpToToday = useAcademicStore((s) => s.jumpToToday);
  const shiftDayColumn = useAcademicStore((s) => s.shiftDayColumn);
  const addTaskBlock = useAcademicStore((s) => s.addTaskBlock);
  const moveTaskBlock = useAcademicStore((s) => s.moveTaskBlock);
  const toggleClassLock = useAcademicStore((s) => s.toggleClassLock);
  const toggleAnchorLock = useAcademicStore((s) => s.toggleAnchorLock);
  const deleteAnchorEvent = useAcademicStore((s) => s.deleteAnchorEvent);
  const dismissRippleLog = useAcademicStore((s) => s.dismissRippleLog);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [advisorDismissed, setAdvisorDismissed] = useState(false);

  const todayKey = getTodayDateKey();
  const days = getRollingDays(timelineStartDate, 7);

  const { advisories } = analyzePredictiveLoad({
    todayKey,
    taskBlocks,
    classSchedules,
    anchorEvents,
    dailyCapacityMinutes,
  });

  const createTask = (dateStr: string, slot: TimeSlot, title: string) =>
    addTaskBlock({
      title,
      courseId: selectedCourseFilter !== 'ALL' ? selectedCourseFilter : courses[0]?.id || '',
      estimatedMinutes: 60,
      scheduledDate: dateStr,
      timeSlot: slot,
      isBuffer: false,
      status: 'TODO',
    });

  const titleByView = {
    BOARD: 'Weekly Timeline',
    CALENDAR: `Calendar · ${formatMonthYear(calendarMonthDate)}`,
    TABLE: 'All Tasks',
  } as const;

  const navigate = (dir: -1 | 1) =>
    workspaceView === 'CALENDAR' ? navigateCalendarMonth(dir) : navigateTimeline(dir * 7);

  return (
    <main className="flex-1 min-w-0 h-full flex flex-col p-4 px-2 select-none">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="section-label truncate">{titleByView[workspaceView]}</span>
          <div className="seg">
            {(
              [
                ['BOARD', 'Week'],
                ['CALENDAR', 'Month'],
                ['TABLE', 'Table'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setWorkspaceView(v)}
                className={`seg-item ${workspaceView === v ? 'is-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {workspaceView !== 'TABLE' && (
          <div className="flex items-center gap-1">
            <button onClick={jumpToToday} className="px-2 py-1 rounded-md font-mono text-[11px] text-muted hover:text-fg hover:bg-elev">
              today
            </button>
            <button onClick={() => navigate(-1)} className="icon-btn" title="Previous">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => navigate(1)} className="icon-btn" title="Next">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {lastRippleLog && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-line bg-panel flex items-center justify-between gap-3 text-xs">
          <span className="font-mono text-[11px] text-muted truncate">
            <span className="text-fg">↻</span> {lastRippleLog.summary}
            {lastRippleLog.deadlineViolations.length > 0 && (
              <span className="text-danger"> · {lastRippleLog.deadlineViolations[0]}</span>
            )}
            {lastRippleLog.capacityOverloads.length > 0 && (
              <span className="text-warn"> · over capacity: {lastRippleLog.capacityOverloads.join(', ')}</span>
            )}
          </span>
          <button onClick={dismissRippleLog} className="icon-btn shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!advisorDismissed && advisories.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-warn/40 bg-warn/10 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-warn shrink-0" />
            <div className="min-w-0">
              <span className="font-medium text-fg">{advisories[0].title}: </span>
              <span className="text-muted">{advisories[0].detail}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {advisories[0].suggestedTaskId && advisories[0].suggestedDate && (
              <button
                onClick={() =>
                  moveTaskBlock(
                    advisories[0].suggestedTaskId!,
                    advisories[0].suggestedDate!,
                    'AFTERNOON'
                  )
                }
                className="px-2 py-1 rounded-md bg-panel border border-line font-mono text-[11px] text-fg hover:border-line-strong"
              >
                Pull Forward
              </button>
            )}
            <button onClick={() => setAdvisorDismissed(true)} className="icon-btn">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {workspaceView === 'CALENDAR' && (
        <NotionCalendarView
          onEditTask={onEditTask}
          onQuickAddTaskAt={onQuickAddTaskAt}
          onEditAnchor={onEditAnchor}
        />
      )}

      {workspaceView === 'TABLE' && (
        <NotionDatabaseTableView onEditTask={onEditTask} onOpenNewTask={onOpenNewTask} />
      )}

      {workspaceView === 'BOARD' && (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full min-w-max pb-1">
            {days.map((dateStr) => {
              const diag = evaluateDayDiagnostics(dateStr, taskBlocks, anchorEvents, dailyCapacityMinutes);
              const isToday = dateStr === todayKey;
              const dayAnchors = anchorEvents.filter(
                (a) =>
                  toDateKey(a.dueDate) === dateStr &&
                  (selectedCourseFilter === 'ALL' || a.courseId === selectedCourseFilter)
              );
              const dayTasks = taskBlocks.filter(
                (t) =>
                  t.scheduledDate === dateStr &&
                  (selectedCourseFilter === 'ALL' || t.courseId === selectedCourseFilter)
              );
              const dayClasses = getClassesForDate(dateStr, classSchedules).filter(
                (cls) => selectedCourseFilter === 'ALL' || cls.courseId === selectedCourseFilter
              );
              const classMinutes = dayClasses.reduce(
                (acc, cls) => acc + getClassDurationMinutes(cls),
                0
              );
              const canShift = dayTasks.some((t) => t.status !== 'DONE' && !t.isBuffer);

              return (
                <section
                  key={dateStr}
                  className={`panel w-[260px] h-full flex flex-col overflow-hidden ${
                    diag.hasAnyWarning ? '!border-danger/50' : isToday ? '!border-line-strong' : ''
                  }`}
                >
                  {/* Day header */}
                  <div className="p-3 shrink-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold tracking-wide text-fg flex items-center gap-2">
                        {formatColumnDate(dateStr)}
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-danger" title="Today" />}
                      </span>
                      <button
                        disabled={!canShift}
                        onClick={() => shiftDayColumn(dateStr, 1)}
                        className="pill hover:text-fg hover:border-line-strong disabled:opacity-40 disabled:pointer-events-none"
                        title="Shift this day's incomplete tasks +1 day"
                      >
                        +1d
                      </button>
                    </div>

                    <div className="font-mono text-[11px] text-muted">
                      <span className={diag.isOverCapacity ? 'text-danger font-semibold' : 'text-fg font-semibold'}>
                        {formatHours(diag.totalMinutes)}
                      </span>{' '}
                      / {formatHours(diag.capacityMinutes)}
                      {classMinutes > 0 && (
                        <span className="text-subtle"> · +{formatHours(classMinutes)} cls</span>
                      )}
                      {diag.isOverCapacity && <span className="text-danger"> · +{diag.overageMinutes}m</span>}
                    </div>

                    <div className="h-1 rounded-full bg-elev overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          diag.isOverCapacity ? 'bg-danger' : 'bg-fg'
                        }`}
                        style={{ width: `${Math.min(100, diag.utilizationPercent)}%` }}
                      />
                    </div>

                    {dayClasses.map((cls) => (
                      <DraggableClassCard
                        key={`${cls.id}-${dateStr}`}
                        cls={cls}
                        dateStr={dateStr}
                        course={courses.find((c) => c.id === cls.courseId)}
                        onEdit={onEditClass}
                        onToggleLock={toggleClassLock}
                      />
                    ))}

                    {dayAnchors.map((anchor) => (
                      <DraggableAnchorCard
                        key={anchor.id}
                        anchor={anchor}
                        course={courses.find((c) => c.id === anchor.courseId)}
                        onEdit={onEditAnchor}
                        onDelete={deleteAnchorEvent}
                        onToggleLock={toggleAnchorLock}
                      />
                    ))}
                  </div>

                  {/* Swimlanes */}
                  <div className="flex-1 overflow-y-auto">
                    {SLOTS.map(({ slot, label }) => {
                      const key = `${dateStr}:${slot}`;
                      return (
                        <Swimlane
                          key={slot}
                          dateStr={dateStr}
                          slot={slot}
                          label={label}
                          tasks={dayTasks
                            .filter((t) => t.timeSlot === slot)
                            .sort((a, b) => a.order - b.order)}
                          courses={courses}
                          allTasks={taskBlocks}
                          allAnchors={anchorEvents}
                          collapsed={Boolean(collapsed[key])}
                          onToggleCollapse={() =>
                            setCollapsed((p) => ({ ...p, [key]: !p[key] }))
                          }
                          onEditTask={onEditTask}
                          onCreate={(title) => createTask(dateStr, slot, title)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
};
