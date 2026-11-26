import React, { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  CalendarClock,
  ExternalLink,
  FastForward,
  Lock,
  Pencil,
  Plus,
  ScrollText,
  Shield,
  Target,
  Trash2,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, ClassSchedule, Course, TaskBlock, TaskStatus, TimeSlot } from '../types/academic';
import {
  CalendarGridCell,
  formatDayHeader,
  getMonthCalendarGrid,
  getTodayDateKey,
  toDateKey,
} from '../utils/dateUtils';
import { evaluateDayDiagnostics, evaluateTaskGuardrails } from '../engines/rippleEngine';
import { getClassesForDate } from '../engines/loadAdvisorEngine';
import { ActionIcon, Checkbox, Dot } from './ui';

/* ============================================================================
 * Calendar task chip (draggable)
 * ========================================================================== */
const CalendarTaskChip: React.FC<{
  task: TaskBlock;
  course?: Course;
  allTasks: TaskBlock[];
  allAnchors: AnchorEvent[];
  onEditTask: (task: TaskBlock) => void;
}> = ({ task, course, allTasks, allAnchors, onEditTask }) => {
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);
  const deleteTaskBlock = useAcademicStore((s) => s.deleteTaskBlock);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: 'TASK_BLOCK', task },
  });

  const isDone = task.status === 'DONE';
  const g = evaluateTaskGuardrails(task, allTasks, allAnchors);
  const violation = g.exceedsAnchorDeadline || g.hasDependencyViolation;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onEditTask(task);
      }}
      className={`group card card-glow flex items-center gap-1.5 px-1.5 py-1 text-[11px] cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-30 z-30' : ''
      } ${violation ? '!border-danger/60' : ''} ${task.isBuffer ? 'border-dashed' : ''}`}
    >
      <Checkbox size="sm" checked={isDone} onToggle={() => toggleTaskStatus(task.id)} />
      <Dot color={course?.colorHex} className="!w-1.5 !h-1.5" />
      <span className={`truncate flex-1 ${isDone ? 'line-through text-subtle' : 'text-fg'}`}>
        {task.title}
      </span>
      <span className="font-mono text-[10px] text-subtle group-hover:hidden">{task.estimatedMinutes}m</span>
      <span className="hidden group-hover:flex -my-1">
        <ActionIcon title="Delete" danger onClick={() => deleteTaskBlock(task.id)}>
          <Trash2 className="w-2.5 h-2.5" />
        </ActionIcon>
      </span>
    </div>
  );
};

/* ============================================================================
 * Calendar class & anchor chips (draggable + lockable)
 * ========================================================================== */
const CalendarClassChip: React.FC<{
  cls: ClassSchedule;
  dateStr: string;
  course?: Course;
}> = ({ cls, dateStr, course }) => {
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
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-elev/80 border border-line text-[10px] text-muted ${
        cls.isLocked ? '' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-30' : ''}`}
      title={`${cls.title} (${cls.startTime}–${cls.endTime})`}
    >
      <CalendarClock className="w-2.5 h-2.5 text-info shrink-0" />
      <Dot color={course?.colorHex} className="!w-1 !h-1" />
      <span className="truncate flex-1 text-fg/85">{cls.title}</span>
      {cls.isLocked && <Lock className="w-2 h-2 text-warn shrink-0" />}
      <span className="font-mono text-[9px] text-subtle shrink-0">{cls.startTime}</span>
    </div>
  );
};

const CalendarAnchorChip: React.FC<{
  anchor: AnchorEvent;
  course?: Course;
  onEditAnchor: (anchor: AnchorEvent) => void;
}> = ({ anchor, course, onEditAnchor }) => {
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
      onClick={(e) => {
        e.stopPropagation();
        onEditAnchor(anchor);
      }}
      className={`flex items-center gap-1 px-1.5 py-1 rounded-md bg-fg text-app text-[11px] font-medium ${
        anchor.isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <Target className="w-3 h-3 shrink-0" />
      <span className="font-mono text-[9px] uppercase opacity-70 shrink-0">
        {course?.code || anchor.type}
      </span>
      <span className="truncate flex-1">{anchor.title}</span>
      {anchor.isLocked && <Lock className="w-2.5 h-2.5 opacity-80 shrink-0" />}
    </div>
  );
};

/* ============================================================================
 * Calendar day cell (droppable)
 * ========================================================================== */
const CalendarDayCell: React.FC<{
  cell: CalendarGridCell;
  isSelected: boolean;
  dayTasks: TaskBlock[];
  dayAnchors: AnchorEvent[];
  onEditTask: (task: TaskBlock) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
}> = ({ cell, isSelected, dayTasks, dayAnchors, onEditTask, onEditAnchor }) => {
  const courses = useAcademicStore((s) => s.courses);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const studyLogs = useAcademicStore((s) => s.studyLogs);
  const dailyCapacityMinutes = useAcademicStore((s) => s.dailyCapacityMinutes);
  const selectedCourseFilter = useAcademicStore((s) => s.selectedCourseFilter);
  const setSelectedCalendarDate = useAcademicStore((s) => s.setSelectedCalendarDate);
  const setInspectedLogDate = useAcademicStore((s) => s.setInspectedLogDate);
  const addTaskBlock = useAcademicStore((s) => s.addTaskBlock);
  const shiftDayColumn = useAcademicStore((s) => s.shiftDayColumn);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: `container:${cell.dateStr}:MORNING`,
    data: { type: 'CONTAINER', scheduledDate: cell.dateStr, timeSlot: 'MORNING' },
  });

  const diag = evaluateDayDiagnostics(cell.dateStr, taskBlocks, anchorEvents, dailyCapacityMinutes);
  const dayClasses = getClassesForDate(cell.dateStr, classSchedules).filter(
    (cls) => selectedCourseFilter === 'ALL' || cls.courseId === selectedCourseFilter
  );
  const dayLogsCount = studyLogs.filter((l) => toDateKey(l.date) === cell.dateStr).length;
  const canShift = dayTasks.some((t) => t.status !== 'DONE' && !t.isBuffer);

  const submit = () => {
    if (title.trim()) {
      addTaskBlock({
        title: title.trim(),
        courseId: selectedCourseFilter !== 'ALL' ? selectedCourseFilter : courses[0]?.id || '',
        estimatedMinutes: 60,
        scheduledDate: cell.dateStr,
        timeSlot: 'MORNING',
        isBuffer: false,
        status: 'TODO',
      });
    }
    setTitle('');
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      onClick={() => setSelectedCalendarDate(cell.dateStr)}
      className={`group relative min-h-[118px] p-1.5 flex flex-col border-r border-b border-line cursor-pointer transition-colors ${
        isOver ? 'bg-elev ring-1 ring-inset ring-line-strong' : isSelected ? 'bg-elev/70' : 'hover:bg-elev/40'
      } ${cell.isCurrentMonth ? '' : 'opacity-45'} ${diag.isOverCapacity ? '!bg-danger/5' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] ${
              cell.isToday ? 'bg-fg text-app font-semibold' : 'text-fg/80'
            }`}
          >
            {cell.dayNumber}
          </span>
          {diag.totalMinutes > 0 && (
            <span className={`font-mono text-[10px] ${diag.isOverCapacity ? 'text-danger' : 'text-subtle'}`}>
              {diag.totalMinutes}m
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCalendarDate(cell.dateStr);
              setInspectedLogDate(cell.dateStr);
            }}
            title={dayLogsCount > 0 ? `See ${dayLogsCount} log(s) for this day` : 'See logs for this day'}
            className={`p-1 rounded hover:bg-elev transition-opacity ${
              dayLogsCount > 0
                ? 'text-info opacity-100'
                : 'text-muted opacity-0 group-hover:opacity-100'
            }`}
          >
            <ScrollText className="w-3 h-3" />
          </button>
          <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
            {canShift && (
              <ActionIcon title="Shift day +1d" onClick={() => shiftDayColumn(cell.dateStr, 1)}>
                <FastForward className="w-3 h-3" />
              </ActionIcon>
            )}
            <ActionIcon title="Add task" onClick={() => setAdding(true)}>
              <Plus className="w-3 h-3" />
            </ActionIcon>
          </div>
        </div>
      </div>

      <div className="space-y-1 flex-1 overflow-y-auto max-h-[140px]">
        {dayClasses.map((cls) => (
          <CalendarClassChip
            key={`${cls.id}-${cell.dateStr}`}
            cls={cls}
            dateStr={cell.dateStr}
            course={courses.find((c) => c.id === cls.courseId)}
          />
        ))}
        {dayAnchors.map((anchor) => (
          <CalendarAnchorChip
            key={anchor.id}
            anchor={anchor}
            course={courses.find((c) => c.id === anchor.courseId)}
            onEditAnchor={onEditAnchor}
          />
        ))}
        {dayTasks.map((task) => (
          <CalendarTaskChip
            key={task.id}
            task={task}
            course={courses.find((c) => c.id === task.courseId)}
            allTasks={taskBlocks}
            allAnchors={anchorEvents}
            onEditTask={onEditTask}
          />
        ))}
        {adding && (
          <input
            autoFocus
            value={title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Task, Enter…"
            className="input !px-1.5 !py-1 !text-[11px]"
          />
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 1. MONTH CALENDAR VIEW
 * ========================================================================== */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const NotionCalendarView: React.FC<{
  onEditTask: (task: TaskBlock) => void;
  onQuickAddTaskAt: (dateStr: string, slot: TimeSlot) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
}> = ({ onEditTask, onQuickAddTaskAt, onEditAnchor }) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const calendarMonthDate = useAcademicStore((s) => s.calendarMonthDate);
  const selectedCalendarDate = useAcademicStore((s) => s.selectedCalendarDate);
  const selectedCourseFilter = useAcademicStore((s) => s.selectedCourseFilter);
  const addTaskBlock = useAcademicStore((s) => s.addTaskBlock);

  const [slot, setSlot] = useState<TimeSlot>('MORNING');
  const [title, setTitle] = useState('');

  const todayKey = getTodayDateKey();
  const grid = getMonthCalendarGrid(calendarMonthDate, todayKey);
  const selHeader = formatDayHeader(selectedCalendarDate, todayKey);

  const byCourse = (courseId: string) =>
    selectedCourseFilter === 'ALL' || courseId === selectedCourseFilter;

  const selectedTasks = taskBlocks.filter(
    (t) => t.scheduledDate === selectedCalendarDate && byCourse(t.courseId)
  );

  const addToSelected = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addTaskBlock({
      title: title.trim(),
      courseId: selectedCourseFilter !== 'ALL' ? selectedCourseFilter : courses[0]?.id || '',
      estimatedMinutes: 60,
      scheduledDate: selectedCalendarDate,
      timeSlot: slot,
      isBuffer: false,
      status: 'TODO',
    });
    setTitle('');
  };

  return (
    <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line shrink-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center section-label !text-[10px]">
            {d}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7">
          {grid.map((cell) => (
            <CalendarDayCell
              key={cell.dateStr}
              cell={cell}
              isSelected={cell.dateStr === selectedCalendarDate}
              dayTasks={taskBlocks
                .filter((t) => t.scheduledDate === cell.dateStr && byCourse(t.courseId))
                .sort((a, b) => a.order - b.order)}
              dayAnchors={anchorEvents.filter(
                (a) => toDateKey(a.dueDate) === cell.dateStr && byCourse(a.courseId)
              )}
              onEditTask={onEditTask}
              onEditAnchor={onEditAnchor}
            />
          ))}
        </div>
      </div>

      {/* Selected day bar */}
      <div className="border-t border-line px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-semibold text-fg uppercase">
            {selHeader.weekday} {selHeader.monthDay}
          </span>
          {selHeader.relativeLabel && <span className="pill">{selHeader.relativeLabel}</span>}
          <span className="font-mono text-[11px] text-muted">
            {selectedTasks.length} tasks · {selectedTasks.reduce((s, t) => s + t.estimatedMinutes, 0)}m
          </span>
        </div>
        <form onSubmit={addToSelected} className="flex items-center gap-2">
          <div className="seg">
            {(['MORNING', 'AFTERNOON', 'EVENING'] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSlot(s)}
                className={`seg-item font-mono !text-[10px] uppercase ${slot === s ? 'is-active' : ''}`}
              >
                {s.slice(0, 3)}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Add task to ${selHeader.monthDay}…`}
            className="input !py-1.5 w-56"
          />
          <button
            type="button"
            onClick={() => onQuickAddTaskAt(selectedCalendarDate, slot)}
            className="btn"
            title="Open full form"
          >
            Details
          </button>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. DATABASE TABLE VIEW
 * ========================================================================== */
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
  MISSED: 'Missed',
};

export const NotionDatabaseTableView: React.FC<{
  onEditTask: (task: TaskBlock) => void;
  onOpenNewTask: () => void;
}> = ({ onEditTask, onOpenNewTask }) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const selectedCourseFilter = useAcademicStore((s) => s.selectedCourseFilter);
  const addTaskBlock = useAcademicStore((s) => s.addTaskBlock);
  const updateTaskBlock = useAcademicStore((s) => s.updateTaskBlock);
  const deleteTaskBlock = useAcademicStore((s) => s.deleteTaskBlock);
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);
  const toggleTaskBuffer = useAcademicStore((s) => s.toggleTaskBuffer);
  const shiftSingleTaskWithCascade = useAcademicStore((s) => s.shiftSingleTaskWithCascade);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(getTodayDateKey());
  const [newSlot, setNewSlot] = useState<TimeSlot>('MORNING');
  const [newMinutes, setNewMinutes] = useState(60);

  const rows = taskBlocks
    .filter((t) => selectedCourseFilter === 'ALL' || t.courseId === selectedCourseFilter)
    .sort((a, b) => {
      if (!a.scheduledDate) return b.scheduledDate ? 1 : a.order - b.order;
      if (!b.scheduledDate) return -1;
      return a.scheduledDate.localeCompare(b.scheduledDate);
    });

  const addRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTaskBlock({
      title: newTitle.trim(),
      courseId: selectedCourseFilter !== 'ALL' ? selectedCourseFilter : courses[0]?.id || '',
      estimatedMinutes: Number(newMinutes) || 60,
      scheduledDate: newDate || null,
      timeSlot: newSlot,
      isBuffer: false,
      status: 'TODO',
    });
    setNewTitle('');
  };

  const cellSelect = 'bg-transparent text-fg text-xs focus:outline-none cursor-pointer';

  return (
    <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-panel z-10">
            <tr className="border-b border-line">
              {['', 'Task', 'Course', 'Status', 'Date', 'Slot', 'Min', 'Deadline', ''].map((h, i) => (
                <th key={i} className="py-2.5 px-3 section-label !text-[10px] font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted">
                  No tasks yet —{' '}
                  <button onClick={onOpenNewTask} className="underline hover:text-fg">
                    create one
                  </button>{' '}
                  or use the row below.
                </td>
              </tr>
            )}
            {rows.map((task) => {
              const course = courses.find((c) => c.id === task.courseId);
              const anchor = anchorEvents.find((a) => a.id === task.anchorId);
              const isDone = task.status === 'DONE';
              const g = evaluateTaskGuardrails(task, taskBlocks, anchorEvents);
              return (
                <tr key={task.id} className="group border-b border-line hover:bg-elev/50 transition-colors">
                  <td className="py-2 px-3 w-8">
                    <Checkbox checked={isDone} onToggle={() => toggleTaskStatus(task.id)} />
                  </td>
                  <td className="py-2 px-3 cursor-pointer" onClick={() => onEditTask(task)}>
                    <div className="flex items-center gap-2">
                      <span className={isDone ? 'line-through text-subtle' : 'text-fg'}>{task.title}</span>
                      {task.isBuffer && <span className="pill">buffer</span>}
                      {g.exceedsAnchorDeadline && (
                        <span className="pill !text-danger !border-danger/40">
                          <AlertCircle className="w-3 h-3" /> late
                        </span>
                      )}
                      {task.resourceLink && (
                        <a
                          href={task.resourceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted hover:text-fg"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    {course ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
                        <Dot color={course.colorHex} className="!w-1.5 !h-1.5" />
                        {course.code}
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskBlock(task.id, { status: e.target.value as TaskStatus })}
                      className={cellSelect}
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="date"
                      value={task.scheduledDate || ''}
                      onChange={(e) => updateTaskBlock(task.id, { scheduledDate: e.target.value || null })}
                      className={`${cellSelect} font-mono text-[11px]`}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={task.timeSlot}
                      onChange={(e) => updateTaskBlock(task.id, { timeSlot: e.target.value as TimeSlot })}
                      className={`${cellSelect} font-mono text-[11px] uppercase`}
                    >
                      <option value="MORNING">Morning</option>
                      <option value="AFTERNOON">Afternoon</option>
                      <option value="EVENING">Evening</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-muted">{task.estimatedMinutes}</td>
                  <td className="py-2 px-3 max-w-[180px]">
                    {anchor ? (
                      <span className="inline-flex items-center gap-1 text-muted truncate max-w-full">
                        <Target className="w-3 h-3 shrink-0" />
                        <span className="truncate">{anchor.title}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="inline-flex opacity-40 group-hover:opacity-100 transition-opacity">
                      <ActionIcon title="Toggle buffer" onClick={() => toggleTaskBuffer(task.id)}>
                        <Shield className={`w-3.5 h-3.5 ${task.isBuffer ? 'text-fg' : ''}`} />
                      </ActionIcon>
                      {task.scheduledDate && !isDone && (
                        <ActionIcon title="Shift +1d" onClick={() => shiftSingleTaskWithCascade(task.id, 1)}>
                          <FastForward className="w-3.5 h-3.5" />
                        </ActionIcon>
                      )}
                      <ActionIcon title="Edit" onClick={() => onEditTask(task)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </ActionIcon>
                      <ActionIcon title="Delete" danger onClick={() => deleteTaskBlock(task.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </ActionIcon>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={addRow} className="border-t border-line px-3 py-2 flex items-center gap-2 shrink-0">
        <Plus className="w-4 h-4 text-muted shrink-0" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New row — type a title and press Enter"
          className="flex-1 bg-transparent text-xs text-fg placeholder:text-subtle focus:outline-none"
        />
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="input !w-auto !py-1 font-mono !text-[11px]"
        />
        <select
          value={newSlot}
          onChange={(e) => setNewSlot(e.target.value as TimeSlot)}
          className="input !w-auto !py-1 font-mono !text-[11px] uppercase"
        >
          <option value="MORNING">Morning</option>
          <option value="AFTERNOON">Afternoon</option>
          <option value="EVENING">Evening</option>
        </select>
        <input
          type="number"
          min={15}
          step={15}
          value={newMinutes}
          onChange={(e) => setNewMinutes(Number(e.target.value))}
          className="input !w-16 !py-1 font-mono !text-[11px]"
        />
        <button type="submit" className="btn-solid">
          Add
        </button>
      </form>
    </div>
  );
};
