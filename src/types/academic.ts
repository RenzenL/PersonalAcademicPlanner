export type AnchorEventType = 'QUIZ' | 'MINOR' | 'MAJOR' | 'ASSIGNMENT';

export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'MISSED';

export type SRRating = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

export type RippleMode = 'BUFFER_FIRST' | 'CASCADE';

export type WorkspaceViewMode = 'BOARD' | 'CALENDAR' | 'TABLE';

export type AppMode = 'PLANNER' | 'KNOWLEDGE';

export type ThemeMode = 'dark' | 'light';

export interface SyllabusTopic {
  id: string;
  title: string;
  completed: boolean;
  weekLabel?: string;
}

export interface Course {
  id: string;
  code: string; // e.g., CS701
  name: string;
  colorHex: string;
  credits: number;
  icon?: string;
  syllabus?: SyllabusTopic[];
  createdAt?: string; // YYYY-MM-DD
}

export interface ClassSchedule {
  id: string;
  courseId: string;
  title: string; // e.g., "Lecture", "Lab", "Recitation"
  daysOfWeek: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  location?: string;
  repeatUntil?: string; // YYYY-MM-DD optional end date
  isLocked?: boolean;
  rescheduledInstances?: Record<string, string>; // orig YYYY-MM-DD -> new YYYY-MM-DD
  deletedInstances?: string[]; // YYYY-MM-DD dates deleted via trash drop
}

export interface Note {
  id: string;
  title: string;
  content: string; // markdown
  courseId: string;
  tags: string[];
  backlinks: string[]; // dynamically mapped wiki-link references [[...]]
  linkedAnchorIds?: string[];
  linkedTaskIds?: string[];
  linkedCardIds?: string[];
  updatedAt: string; // ISO string
}

export interface StudyLog {
  id: string;
  courseId?: string; // undefined when outside curriculum
  customTopic?: string; // populated when outside curriculum
  date: string; // YYYY-MM-DD
  minutes: number;
  notes?: string; // optional what you studied
  type?: 'STUDY' | 'TASK_DONE' | 'ANCHOR_DONE';
  refId?: string;
  createdAt: string; // ISO timestamp
}

export interface AnchorEvent {
  id: string;
  courseId: string;
  type: AnchorEventType;
  title: string;
  dueDate: string; // ISO string or YYYY-MM-DD
  timeSlot?: TimeSlot;
  weightage: number; // percentage (0 - 100)
  completed: boolean;
  isLocked?: boolean;
}

export interface TaskBlock {
  id: string;
  courseId: string;
  anchorId?: string; // optional link to an exam/assignment
  title: string;
  estimatedMinutes: number;
  scheduledDate: string | null; // YYYY-MM-DD, or null when unscheduled
  timeSlot: TimeSlot;
  order: number;
  dependencyId?: string; // optional parent task ID
  isBuffer: boolean;
  isLocked?: boolean;
  resourceLink?: string; // optional URL/URI
  status: TaskStatus;
}

export interface SpacedRepetitionCard {
  id: string;
  courseId: string;
  anchorId?: string; // optional link to AnchorEvent
  topicTitle: string;
  promptQuestion: string;
  answerNotes: string;
  resourceLink?: string;
  easeFactor: number; // default 2.5
  intervalDays: number; // default 0
  repetitions: number; // default 0
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedDate?: string; // YYYY-MM-DD
  lastExamClamped?: boolean;
}

export interface RippleActionLog {
  timestamp: string;
  summary: string;
  shiftedTaskIds: string[];
  absorbedByBufferIds: string[];
  deadlineViolations: string[];
  capacityOverloads: string[];
}

export interface AcademicBackupPayload {
  version: number;
  exportedAt: string;
  dailyCapacityMinutes: number;
  rippleMode: RippleMode;
  courses: Course[];
  anchorEvents: AnchorEvent[];
  taskBlocks: TaskBlock[];
  srCards: SpacedRepetitionCard[];
  classSchedules?: ClassSchedule[];
  studyLogs?: StudyLog[];
  notes?: Note[];
}
