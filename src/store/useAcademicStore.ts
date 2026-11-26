import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AcademicBackupPayload,
  AnchorEvent,
  AppMode,
  ClassSchedule,
  Course,
  Note,
  RippleActionLog,
  RippleMode,
  SpacedRepetitionCard,
  SRRating,
  StudyLog,
  SyllabusTopic,
  TaskBlock,
  TaskStatus,
  ThemeMode,
  TimeSlot,
  WorkspaceViewMode,
} from '../types/academic';
import {
  createEmptyAcademicData,
  createNotionSampleTemplate,
} from '../data/seedData';
import { addDays, addMonths, getTodayDateKey } from '../utils/dateUtils';
import {
  executeModularRipple,
  rippleAllMissedTasks,
  shiftDayColumnTasks,
} from '../engines/rippleEngine';
import { calculateSM2Review, SM2ReviewResult } from '../engines/sm2Engine';

export interface AcademicState {
  courses: Course[];
  anchorEvents: AnchorEvent[];
  taskBlocks: TaskBlock[];
  srCards: SpacedRepetitionCard[];
  classSchedules: ClassSchedule[];
  studyLogs: StudyLog[];
  notes: Note[];

  // Engine Configuration
  dailyCapacityMinutes: number;
  rippleMode: RippleMode;
  lastRippleLog: RippleActionLog | null;

  // View & Filter State
  appMode: AppMode;
  selectedNoteId: string | null;
  workspaceView: WorkspaceViewMode;
  timelineStartDate: string;
  calendarMonthDate: string;
  selectedCalendarDate: string;
  selectedCourseFilter: string | 'ALL';
  selectedAnchorTypeFilter: string | 'ALL';
  isRightPaneCollapsed: boolean;
  isLeftPaneCollapsed: boolean;
  theme: ThemeMode;
  inspectedLogDate: string | null;

  // Course & Syllabus Actions
  addCourse: (course: Omit<Course, 'id'>) => Course;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  addSyllabusTopic: (courseId: string, title: string, weekLabel?: string) => void;
  toggleSyllabusTopic: (courseId: string, topicId: string) => void;
  deleteSyllabusTopic: (courseId: string, topicId: string) => void;
  importSyllabusLines: (courseId: string, rawText: string) => void;

  // Weekly Class Schedule Actions
  addClassSchedule: (cls: Omit<ClassSchedule, 'id'>) => ClassSchedule;
  updateClassSchedule: (id: string, patch: Partial<ClassSchedule>) => void;
  deleteClassSchedule: (id: string) => void;
  toggleClassLock: (id: string) => void;
  moveClassInstance: (classId: string, visibleOrigDate: string, targetDate: string) => void;
  deleteClassInstance: (classId: string, visibleDateStr: string) => void;

  // Knowledge Base / Note Actions
  addNote: (note: Partial<Omit<Note, 'id' | 'updatedAt' | 'backlinks'>>) => Note;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id'>>) => void;
  deleteNote: (id: string) => void;
  setSelectedNoteId: (id: string | null) => void;
  setAppMode: (mode: AppMode) => void;

  // Study Log Actions (Pre-registered courses + Outside Curriculum)
  addStudyLog: (log: Omit<StudyLog, 'id' | 'createdAt'>) => StudyLog;
  updateStudyLog: (id: string, patch: Partial<StudyLog>) => void;
  deleteStudyLog: (id: string) => void;

  // AnchorEvent Actions
  addAnchorEvent: (anchor: Omit<AnchorEvent, 'id'>) => AnchorEvent;
  updateAnchorEvent: (id: string, patch: Partial<AnchorEvent>) => void;
  toggleAnchorCompleted: (id: string) => void;
  toggleAnchorLock: (id: string) => void;
  moveAnchorEvent: (id: string, targetDate: string, targetSlot?: TimeSlot) => void;
  deleteAnchorEvent: (id: string) => void;

  // TaskBlock Actions
  addTaskBlock: (task: Omit<TaskBlock, 'id' | 'order'>) => TaskBlock;
  updateTaskBlock: (id: string, patch: Partial<TaskBlock>) => void;
  deleteTaskBlock: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskBuffer: (id: string) => void;
  toggleTaskLock: (id: string) => void;
  moveTaskBlock: (
    taskId: string,
    targetDate: string | null,
    targetSlot: TimeSlot,
    targetIndex?: number
  ) => void;

  // Modular Ripple & Bulk-Shifting Actions
  shiftDayColumn: (dateStr: string, daysDelta?: number) => RippleActionLog;
  rippleMissedTasks: () => RippleActionLog;
  shiftSingleTaskWithCascade: (taskId: string, daysDelta: number) => RippleActionLog;
  setDailyCapacityMinutes: (minutes: number) => void;
  setRippleMode: (mode: RippleMode) => void;
  dismissRippleLog: () => void;

  // Spaced Repetition Actions
  addSRCard: (
    card: Omit<
      SpacedRepetitionCard,
      'id' | 'easeFactor' | 'intervalDays' | 'repetitions' | 'nextReviewDate'
    > & {
      easeFactor?: number;
      intervalDays?: number;
      repetitions?: number;
      nextReviewDate?: string;
    }
  ) => SpacedRepetitionCard;
  updateSRCard: (id: string, patch: Partial<SpacedRepetitionCard>) => void;
  deleteSRCard: (id: string) => void;
  reviewSRCard: (cardId: string, rating: SRRating) => SM2ReviewResult | null;

  // Navigation & UI Actions
  setWorkspaceView: (view: WorkspaceViewMode) => void;
  navigateTimeline: (deltaDays: number) => void;
  navigateCalendarMonth: (deltaMonths: number) => void;
  setSelectedCalendarDate: (dateStr: string) => void;
  jumpToToday: () => void;
  setSelectedCourseFilter: (courseId: string | 'ALL') => void;
  setSelectedAnchorTypeFilter: (type: string | 'ALL') => void;
  setRightPaneCollapsed: (collapsed: boolean) => void;
  setLeftPaneCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  setInspectedLogDate: (date: string | null) => void;

  // Backup, Template & Restore Actions
  exportBackupJSON: () => string;
  importBackupJSON: (jsonStr: string) => { ok: boolean; error?: string };
  loadSampleTemplate: () => void;
  clearAllData: () => void;
}

const emptyInit = createEmptyAcademicData();
const todayInit = getTodayDateKey();

function extractWikiLinkTokens(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^\]]+)\]\]/g);
  const out = new Set<string>();
  for (const m of matches) {
    const token = m[1]?.trim();
    if (token) out.add(token.toLowerCase());
  }
  return Array.from(out);
}

function recomputeNoteBacklinks(notes: Note[]): Note[] {
  // For each note N, backlinks = IDs of all other notes M whose [[...]] tokens match N.title
  const tokensByNoteId = new Map<string, string[]>();
  for (const n of notes) {
    tokensByNoteId.set(n.id, extractWikiLinkTokens(n.content));
  }
  return notes.map((target) => {
    const targetTitleLower = target.title.trim().toLowerCase();
    const backlinks: string[] = [];
    for (const source of notes) {
      if (source.id === target.id) continue;
      const tokens = tokensByNoteId.get(source.id) || [];
      if (targetTitleLower && tokens.includes(targetTitleLower)) {
        backlinks.push(source.id);
      }
    }
    return { ...target, backlinks };
  });
}

export const useAcademicStore = create<AcademicState>()(
  persist(
    (set, get) => ({
      courses: emptyInit.courses,
      anchorEvents: emptyInit.anchorEvents,
      taskBlocks: emptyInit.taskBlocks,
      srCards: emptyInit.srCards,
      classSchedules: emptyInit.classSchedules,
      studyLogs: emptyInit.studyLogs,
      notes: emptyInit.notes,

      dailyCapacityMinutes: 360,
      rippleMode: 'BUFFER_FIRST',
      lastRippleLog: null,

      appMode: 'PLANNER',
      selectedNoteId: null,
      workspaceView: 'BOARD',
      timelineStartDate: todayInit,
      calendarMonthDate: todayInit,
      selectedCalendarDate: todayInit,
      selectedCourseFilter: 'ALL',
      selectedAnchorTypeFilter: 'ALL',
      isRightPaneCollapsed: false,
      isLeftPaneCollapsed: false,
      theme: 'dark',
      inspectedLogDate: null,

      addCourse: (course) => {
        const newCourse: Course = {
          ...course,
          id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          syllabus: course.syllabus ?? [],
          createdAt: course.createdAt ?? getTodayDateKey(),
        };
        set((state) => ({
          courses: [...state.courses, newCourse],
        }));
        return newCourse;
      },

      updateCourse: (id, patch) =>
        set((state) => ({
          courses: state.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      deleteCourse: (id) =>
        set((state) => ({
          courses: state.courses.filter((c) => c.id !== id),
          anchorEvents: state.anchorEvents.filter((a) => a.courseId !== id),
          classSchedules: state.classSchedules.filter((cs) => cs.courseId !== id),
          studyLogs: state.studyLogs.filter((sl) => sl.courseId !== id),
          taskBlocks: state.taskBlocks.map((t) =>
            t.courseId === id ? { ...t, courseId: '' } : t
          ),
          srCards: state.srCards.map((s) =>
            s.courseId === id ? { ...s, courseId: '' } : s
          ),
          selectedCourseFilter:
            state.selectedCourseFilter === id ? 'ALL' : state.selectedCourseFilter,
        })),

      addSyllabusTopic: (courseId, title, weekLabel) =>
        set((state) => ({
          courses: state.courses.map((c) => {
            if (c.id !== courseId) return c;
            const topic: SyllabusTopic = {
              id: `syl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: title.trim(),
              completed: false,
              weekLabel: weekLabel?.trim() || undefined,
            };
            return { ...c, syllabus: [...(c.syllabus || []), topic] };
          }),
        })),

      toggleSyllabusTopic: (courseId, topicId) =>
        set((state) => ({
          courses: state.courses.map((c) => {
            if (c.id !== courseId) return c;
            return {
              ...c,
              syllabus: (c.syllabus || []).map((t) =>
                t.id === topicId ? { ...t, completed: !t.completed } : t
              ),
            };
          }),
        })),

      deleteSyllabusTopic: (courseId, topicId) =>
        set((state) => ({
          courses: state.courses.map((c) => {
            if (c.id !== courseId) return c;
            return {
              ...c,
              syllabus: (c.syllabus || []).filter((t) => t.id !== topicId),
            };
          }),
        })),

      importSyllabusLines: (courseId, rawText) =>
        set((state) => {
          const lines = rawText
            .split(/\r?\n/)
            .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
            .filter(Boolean);
          if (lines.length === 0) return state;
          return {
            courses: state.courses.map((c) => {
              if (c.id !== courseId) return c;
              const additions: SyllabusTopic[] = lines.map((line, i) => ({
                id: `syl-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
                title: line,
                completed: false,
              }));
              return { ...c, syllabus: [...(c.syllabus || []), ...additions] };
            }),
          };
        }),

      addClassSchedule: (cls) => {
        const state = get();
        // If a class schedule with the same courseId and title already exists, update it instead of duplicating
        const existing = state.classSchedules.find(
          (c) =>
            c.courseId === cls.courseId &&
            c.title.trim().toLowerCase() === cls.title.trim().toLowerCase()
        );
        if (existing) {
          const nextRepeatUntil = cls.repeatUntil || undefined;
          const prunedResched: Record<string, string> = {};
          for (const [orig, dest] of Object.entries(existing.rescheduledInstances || {})) {
            if (!nextRepeatUntil || (orig <= nextRepeatUntil && dest <= nextRepeatUntil)) {
              prunedResched[orig] = dest;
            }
          }
          const updated: ClassSchedule = {
            ...existing,
            ...cls,
            repeatUntil: nextRepeatUntil,
            rescheduledInstances: prunedResched,
          };
          set((s) => ({
            classSchedules: s.classSchedules.map((c) =>
              c.id === existing.id ? updated : c
            ),
          }));
          return updated;
        }

        const created: ClassSchedule = {
          ...cls,
          id: `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        set((s) => ({
          classSchedules: [...s.classSchedules, created],
        }));
        return created;
      },

      updateClassSchedule: (id, patch) =>
        set((state) => {
          const target = state.classSchedules.find((c) => c.id === id);
          if (!target) return state;
          const nextRepeatUntil =
            'repeatUntil' in patch ? patch.repeatUntil || undefined : target.repeatUntil;

          // Also deduplicate any accidental earlier copies of the same course + title so old end dates never linger
          const targetCourseId = patch.courseId ?? target.courseId;
          const targetTitle = (patch.title ?? target.title).trim().toLowerCase();

          return {
            classSchedules: state.classSchedules
              .filter(
                (c) =>
                  c.id === id ||
                  !(
                    c.courseId === targetCourseId &&
                    c.title.trim().toLowerCase() === targetTitle
                  )
              )
              .map((c) => {
                if (c.id !== id) return c;
                const prunedResched: Record<string, string> = {};
                for (const [orig, dest] of Object.entries(c.rescheduledInstances || {})) {
                  if (
                    !nextRepeatUntil ||
                    (orig <= nextRepeatUntil && dest <= nextRepeatUntil)
                  ) {
                    prunedResched[orig] = dest;
                  }
                }
                return {
                  ...c,
                  ...patch,
                  repeatUntil: nextRepeatUntil,
                  rescheduledInstances: prunedResched,
                };
              }),
          };
        }),

      deleteClassSchedule: (id) =>
        set((state) => ({
          classSchedules: state.classSchedules.filter((c) => c.id !== id),
        })),

      toggleClassLock: (id) =>
        set((state) => ({
          classSchedules: state.classSchedules.map((c) =>
            c.id === id ? { ...c, isLocked: !c.isLocked } : c
          ),
        })),

      moveClassInstance: (classId, visibleOrigDate, targetDate) =>
        set((state) => ({
          classSchedules: state.classSchedules.map((c) => {
            if (c.id !== classId || c.isLocked) return c;
            const resched = { ...(c.rescheduledInstances || {}) };
            const existingEntry = Object.entries(resched).find(
              ([, dest]) => dest === visibleOrigDate
            );
            const origKey = existingEntry ? existingEntry[0] : visibleOrigDate;
            if (origKey === targetDate) {
              delete resched[origKey];
            } else {
              resched[origKey] = targetDate;
            }
            return { ...c, rescheduledInstances: resched };
          }),
        })),

      deleteClassInstance: (classId, visibleDateStr) =>
        set((state) => ({
          classSchedules: state.classSchedules.map((c) => {
            if (c.id !== classId || c.isLocked) return c;
            const deleted = Array.from(
              new Set([...(c.deletedInstances || []), visibleDateStr])
            );
            const resched = { ...(c.rescheduledInstances || {}) };
            for (const [orig, dest] of Object.entries(resched)) {
              if (dest === visibleDateStr || orig === visibleDateStr) {
                delete resched[orig];
              }
            }
            return {
              ...c,
              deletedInstances: deleted,
              rescheduledInstances: resched,
            };
          }),
        })),

      addNote: (partial) => {
        const state = get();
        const created: Note = {
          id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: partial.title?.trim() || 'Untitled Note',
          content:
            partial.content ??
            `# ${partial.title?.trim() || 'Untitled Note'}\n\nType \`[[\` to link notes, exams, or tasks, or write math with $f(x)$.\n`,
          courseId: partial.courseId ?? (state.courses[0]?.id || ''),
          tags: partial.tags ?? [],
          backlinks: [],
          linkedAnchorIds: partial.linkedAnchorIds ?? [],
          linkedTaskIds: partial.linkedTaskIds ?? [],
          linkedCardIds: partial.linkedCardIds ?? [],
          updatedAt: new Date().toISOString(),
        };
        set((s) => {
          const nextNotes = recomputeNoteBacklinks([created, ...s.notes]);
          return {
            notes: nextNotes,
            selectedNoteId: created.id,
          };
        });
        return created;
      },

      updateNote: (id, patch) =>
        set((state) => {
          const updatedList = state.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                }
              : n
          );
          return {
            notes: recomputeNoteBacklinks(updatedList),
          };
        }),

      deleteNote: (id) =>
        set((state) => {
          const remaining = recomputeNoteBacklinks(
            state.notes.filter((n) => n.id !== id)
          );
          return {
            notes: remaining,
            selectedNoteId:
              state.selectedNoteId === id
                ? remaining[0]?.id || null
                : state.selectedNoteId,
          };
        }),

      setSelectedNoteId: (id) => set({ selectedNoteId: id }),

      setAppMode: (mode) => set({ appMode: mode }),

      addStudyLog: (log) => {
        const created: StudyLog = {
          ...log,
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          studyLogs: [created, ...state.studyLogs],
        }));
        return created;
      },

      updateStudyLog: (id, patch) =>
        set((state) => ({
          studyLogs: state.studyLogs.map((l) =>
            l.id === id ? { ...l, ...patch } : l
          ),
        })),

      deleteStudyLog: (id) =>
        set((state) => ({
          studyLogs: state.studyLogs.filter((l) => l.id !== id),
        })),

      addAnchorEvent: (anchor) => {
        const newAnchor: AnchorEvent = {
          ...anchor,
          id: `anchor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        set((state) => ({
          anchorEvents: [...state.anchorEvents, newAnchor],
        }));
        return newAnchor;
      },

      updateAnchorEvent: (id, patch) =>
        set((state) => ({
          anchorEvents: state.anchorEvents.map((a) =>
            a.id === id ? { ...a, ...patch } : a
          ),
        })),

      toggleAnchorCompleted: (id) =>
        set((state) => {
          const target = state.anchorEvents.find((a) => a.id === id);
          if (!target) return state;
          const nextCompleted = !target.completed;
          let nextLogs = state.studyLogs;
          if (nextCompleted && !state.studyLogs.some((l) => l.refId === id)) {
            const log: StudyLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              courseId: target.courseId || undefined,
              customTopic: !target.courseId ? target.title : undefined,
              date: getTodayDateKey(),
              minutes: 45,
              notes: `Completed ${target.type}: ${target.title}`,
              type: 'ANCHOR_DONE',
              refId: id,
              createdAt: new Date().toISOString(),
            };
            nextLogs = [log, ...state.studyLogs];
          }
          return {
            anchorEvents: state.anchorEvents.map((a) =>
              a.id === id ? { ...a, completed: nextCompleted } : a
            ),
            studyLogs: nextLogs,
          };
        }),

      toggleAnchorLock: (id) =>
        set((state) => ({
          anchorEvents: state.anchorEvents.map((a) =>
            a.id === id ? { ...a, isLocked: !a.isLocked } : a
          ),
        })),

      moveAnchorEvent: (id, targetDate, targetSlot) =>
        set((state) => ({
          anchorEvents: state.anchorEvents.map((a) => {
            if (a.id !== id || a.isLocked) return a;
            return {
              ...a,
              dueDate: targetDate,
              timeSlot: targetSlot ?? a.timeSlot ?? 'MORNING',
            };
          }),
        })),

      deleteAnchorEvent: (id) =>
        set((state) => ({
          anchorEvents: state.anchorEvents.filter((a) => a.id !== id),
          taskBlocks: state.taskBlocks.map((t) =>
            t.anchorId === id ? { ...t, anchorId: undefined } : t
          ),
          srCards: state.srCards.map((c) =>
            c.anchorId === id ? { ...c, anchorId: undefined } : c
          ),
        })),

      addTaskBlock: (task) => {
        const state = get();
        const sameSlotTasks = state.taskBlocks.filter(
          (t) =>
            t.scheduledDate === task.scheduledDate && t.timeSlot === task.timeSlot
        );
        const nextOrder =
          sameSlotTasks.length > 0
            ? Math.max(...sameSlotTasks.map((t) => t.order)) + 1
            : 0;
        const newTask: TaskBlock = {
          ...task,
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order: nextOrder,
        };
        set((prev) => ({
          taskBlocks: [...prev.taskBlocks, newTask],
        }));
        return newTask;
      },

      updateTaskBlock: (id, patch) =>
        set((state) => ({
          taskBlocks: state.taskBlocks.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        })),

      deleteTaskBlock: (id) =>
        set((state) => ({
          taskBlocks: state.taskBlocks
            .filter((t) => t.id !== id)
            .map((t) =>
              t.dependencyId === id ? { ...t, dependencyId: undefined } : t
            ),
        })),

      toggleTaskStatus: (id) =>
        set((state) => {
          const target = state.taskBlocks.find((t) => t.id === id);
          if (!target) return state;
          const nextStatus: TaskStatus = target.status === 'DONE' ? 'TODO' : 'DONE';
          let nextLogs = state.studyLogs;
          if (nextStatus === 'DONE' && !state.studyLogs.some((l) => l.refId === id)) {
            const log: StudyLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              courseId: target.courseId || undefined,
              customTopic: !target.courseId ? target.title : undefined,
              date: getTodayDateKey(),
              minutes: target.estimatedMinutes || 30,
              notes: `Completed task: ${target.title}`,
              type: 'TASK_DONE',
              refId: id,
              createdAt: new Date().toISOString(),
            };
            nextLogs = [log, ...state.studyLogs];
          }
          return {
            taskBlocks: state.taskBlocks.map((t) =>
              t.id === id ? { ...t, status: nextStatus } : t
            ),
            studyLogs: nextLogs,
          };
        }),

      toggleTaskLock: (id) =>
        set((state) => ({
          taskBlocks: state.taskBlocks.map((t) =>
            t.id === id ? { ...t, isLocked: !t.isLocked } : t
          ),
        })),

      setTaskStatus: (id, status) =>
        set((state) => ({
          taskBlocks: state.taskBlocks.map((t) =>
            t.id === id ? { ...t, status } : t
          ),
        })),

      toggleTaskBuffer: (id) =>
        set((state) => ({
          taskBlocks: state.taskBlocks.map((t) =>
            t.id === id ? { ...t, isBuffer: !t.isBuffer } : t
          ),
        })),

      moveTaskBlock: (taskId, targetDate, targetSlot, targetIndex) =>
        set((state) => {
          const movingTask = state.taskBlocks.find((t) => t.id === taskId);
          if (!movingTask || movingTask.isLocked) return state;

          const otherTasks = state.taskBlocks.filter((t) => t.id !== taskId);
          const destinationTasks = otherTasks
            .filter(
              (t) => t.scheduledDate === targetDate && t.timeSlot === targetSlot
            )
            .sort((a, b) => a.order - b.order);

          const updatedMovingTask: TaskBlock = {
            ...movingTask,
            scheduledDate: targetDate,
            timeSlot: targetSlot,
            status:
              movingTask.status === 'MISSED' &&
              targetDate &&
              targetDate >= getTodayDateKey()
                ? 'TODO'
                : movingTask.status,
          };

          const insertAt =
            typeof targetIndex === 'number'
              ? Math.max(0, Math.min(destinationTasks.length, targetIndex))
              : destinationTasks.length;

          destinationTasks.splice(insertAt, 0, updatedMovingTask);

          const reorderedDestinationIds = new Map<string, number>();
          destinationTasks.forEach((t, idx) => {
            reorderedDestinationIds.set(t.id, idx);
          });

          const finalTasks = [
            ...otherTasks.filter(
              (t) => !(t.scheduledDate === targetDate && t.timeSlot === targetSlot)
            ),
            ...destinationTasks.map((t) => ({
              ...t,
              order: reorderedDestinationIds.get(t.id) ?? 0,
            })),
          ];

          return { taskBlocks: finalTasks };
        }),

      shiftDayColumn: (dateStr, daysDelta = 1) => {
        const state = get();
        const result = shiftDayColumnTasks(
          state.taskBlocks,
          state.anchorEvents,
          dateStr,
          daysDelta,
          state.rippleMode,
          state.dailyCapacityMinutes
        );
        set({
          taskBlocks: result.updatedTasks,
          lastRippleLog: result.log,
        });
        return result.log;
      },

      rippleMissedTasks: () => {
        const state = get();
        const todayStr = getTodayDateKey();
        const result = rippleAllMissedTasks(
          state.taskBlocks,
          state.anchorEvents,
          todayStr,
          state.rippleMode,
          state.dailyCapacityMinutes
        );
        set({
          taskBlocks: result.updatedTasks,
          lastRippleLog: result.log,
        });
        return result.log;
      },

      shiftSingleTaskWithCascade: (taskId, daysDelta) => {
        const state = get();
        const result = executeModularRipple({
          tasks: state.taskBlocks,
          anchorEvents: state.anchorEvents,
          targetTaskIds: [taskId],
          daysDelta,
          mode: state.rippleMode,
          dailyCapacityMinutes: state.dailyCapacityMinutes,
          actionLabel: `Shift (+${daysDelta}d)`,
        });
        set({
          taskBlocks: result.updatedTasks,
          lastRippleLog: result.log,
        });
        return result.log;
      },

      setDailyCapacityMinutes: (minutes) =>
        set({ dailyCapacityMinutes: Math.max(60, Math.min(960, minutes)) }),

      setRippleMode: (mode) => set({ rippleMode: mode }),

      dismissRippleLog: () => set({ lastRippleLog: null }),

      addSRCard: (cardInput) => {
        const newCard: SpacedRepetitionCard = {
          ...cardInput,
          id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          easeFactor: cardInput.easeFactor ?? 2.5,
          intervalDays: cardInput.intervalDays ?? 0,
          repetitions: cardInput.repetitions ?? 0,
          nextReviewDate: cardInput.nextReviewDate ?? getTodayDateKey(),
        };
        set((state) => ({
          srCards: [...state.srCards, newCard],
        }));
        return newCard;
      },

      updateSRCard: (id, patch) =>
        set((state) => ({
          srCards: state.srCards.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),

      deleteSRCard: (id) =>
        set((state) => ({
          srCards: state.srCards.filter((c) => c.id !== id),
        })),

      reviewSRCard: (cardId, rating) => {
        const state = get();
        const card = state.srCards.find((c) => c.id === cardId);
        if (!card) return null;

        const reviewOutcome = calculateSM2Review(
          card,
          rating,
          getTodayDateKey(),
          state.anchorEvents
        );

        set((prev) => ({
          srCards: prev.srCards.map((c) =>
            c.id === cardId ? reviewOutcome.updatedCard : c
          ),
        }));

        return reviewOutcome;
      },

      setWorkspaceView: (view) => set({ workspaceView: view }),

      navigateTimeline: (deltaDays) =>
        set((state) => ({
          timelineStartDate: addDays(state.timelineStartDate, deltaDays),
        })),

      navigateCalendarMonth: (deltaMonths) =>
        set((state) => ({
          calendarMonthDate: addMonths(state.calendarMonthDate, deltaMonths),
        })),

      setSelectedCalendarDate: (dateStr) =>
        set({
          selectedCalendarDate: dateStr,
          calendarMonthDate: dateStr,
          timelineStartDate: dateStr,
        }),

      jumpToToday: () => {
        const t = getTodayDateKey();
        set({
          timelineStartDate: t,
          calendarMonthDate: t,
          selectedCalendarDate: t,
        });
      },

      setSelectedCourseFilter: (courseId) =>
        set({ selectedCourseFilter: courseId }),

      setSelectedAnchorTypeFilter: (type) =>
        set({ selectedAnchorTypeFilter: type }),

      setRightPaneCollapsed: (collapsed) =>
        set({ isRightPaneCollapsed: collapsed }),

      setLeftPaneCollapsed: (collapsed) =>
        set({ isLeftPaneCollapsed: collapsed }),

      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      setInspectedLogDate: (date) => set({ inspectedLogDate: date }),

      exportBackupJSON: () => {
        const state = get();
        const payload: AcademicBackupPayload = {
          version: 4,
          exportedAt: new Date().toISOString(),
          dailyCapacityMinutes: state.dailyCapacityMinutes,
          rippleMode: state.rippleMode,
          courses: state.courses,
          anchorEvents: state.anchorEvents,
          taskBlocks: state.taskBlocks,
          srCards: state.srCards,
          classSchedules: state.classSchedules,
          studyLogs: state.studyLogs,
          notes: state.notes,
        };
        return JSON.stringify(payload, null, 2);
      },

      importBackupJSON: (jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr) as Partial<AcademicBackupPayload>;
          if (
            !Array.isArray(parsed.courses) ||
            !Array.isArray(parsed.anchorEvents) ||
            !Array.isArray(parsed.taskBlocks) ||
            !Array.isArray(parsed.srCards)
          ) {
            return {
              ok: false,
              error:
                'Invalid backup structure: courses, anchorEvents, taskBlocks, and srCards arrays are required.',
            };
          }
          set({
            courses: parsed.courses,
            anchorEvents: parsed.anchorEvents,
            taskBlocks: parsed.taskBlocks,
            srCards: parsed.srCards,
            classSchedules: Array.isArray(parsed.classSchedules)
              ? parsed.classSchedules
              : [],
            studyLogs: Array.isArray(parsed.studyLogs) ? parsed.studyLogs : [],
            notes: Array.isArray(parsed.notes)
              ? recomputeNoteBacklinks(parsed.notes)
              : [],
            dailyCapacityMinutes:
              typeof parsed.dailyCapacityMinutes === 'number'
                ? parsed.dailyCapacityMinutes
                : 360,
            rippleMode:
              parsed.rippleMode === 'CASCADE' || parsed.rippleMode === 'BUFFER_FIRST'
                ? parsed.rippleMode
                : 'BUFFER_FIRST',
          });
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to parse JSON file.',
          };
        }
      },

      loadSampleTemplate: () => {
        const sample = createNotionSampleTemplate(getTodayDateKey());
        const t = getTodayDateKey();
        set({
          courses: sample.courses,
          anchorEvents: sample.anchorEvents,
          taskBlocks: sample.taskBlocks,
          srCards: sample.srCards,
          classSchedules: sample.classSchedules,
          studyLogs: sample.studyLogs,
          notes: recomputeNoteBacklinks(sample.notes),
          selectedNoteId: sample.notes[0]?.id || null,
          selectedCourseFilter: 'ALL',
          selectedAnchorTypeFilter: 'ALL',
          timelineStartDate: addDays(t, -1),
          calendarMonthDate: t,
          selectedCalendarDate: t,
          lastRippleLog: null,
        });
      },

      clearAllData: () => {
        const empty = createEmptyAcademicData();
        const t = getTodayDateKey();
        set({
          courses: empty.courses,
          anchorEvents: empty.anchorEvents,
          taskBlocks: empty.taskBlocks,
          srCards: empty.srCards,
          classSchedules: empty.classSchedules,
          studyLogs: empty.studyLogs,
          notes: empty.notes,
          selectedNoteId: null,
          selectedCourseFilter: 'ALL',
          selectedAnchorTypeFilter: 'ALL',
          timelineStartDate: t,
          calendarMonthDate: t,
          selectedCalendarDate: t,
          lastRippleLog: null,
        });
      },
    }),
    {
      name: 'kronos-notion-v3',
    }
  )
);
