import React, { useEffect, useState } from 'react';
import {
  closestCorners,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Trash2 } from 'lucide-react';
import { useAcademicStore } from './store/useAcademicStore';
import {
  AnchorEvent,
  ClassSchedule,
  Course,
  TaskBlock,
  TimeSlot,
} from './types/academic';
import { TopBar } from './components/TopBar';
import { LeftPaneRadar } from './components/LeftPaneRadar';
import { CenterPaneTimeline } from './components/CenterPaneTimeline';
import { RightPaneSRQueue } from './components/RightPaneSRQueue';
import {
  AnchorEventModal,
  ClassScheduleModal,
  CourseModal,
  StudyLogModal,
  TaskBlockModal,
} from './components/Modals';
import { CommandPalette } from './components/CommandPalette';
import { TaskBlockCard } from './components/TaskBlockCard';
import { KnowledgeBaseWorkspace } from './components/KnowledgeBaseWorkspace';
import { getTodayDateKey } from './utils/dateUtils';

const DragTrashDropZone: React.FC = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'container:TRASH',
    data: { type: 'TRASH' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 shadow-2xl transition-all duration-150 select-none ${
        isOver
          ? 'bg-danger text-white border-danger scale-105'
          : 'bg-panel/95 backdrop-blur text-danger border-danger/60'
      }`}
    >
      <Trash2 className="w-4 h-4" />
      <span className="font-mono text-xs font-semibold tracking-wide">
        {isOver ? 'Release to Delete Block' : 'Drop Here to Delete'}
      </span>
    </div>
  );
};

const multiContainerCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

export function App() {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const appMode = useAcademicStore((s) => s.appMode);
  const theme = useAcademicStore((s) => s.theme);
  const isLeftPaneCollapsed = useAcademicStore((s) => s.isLeftPaneCollapsed);
  const moveTaskBlock = useAcademicStore((s) => s.moveTaskBlock);
  const moveAnchorEvent = useAcademicStore((s) => s.moveAnchorEvent);
  const moveClassInstance = useAcademicStore((s) => s.moveClassInstance);
  const deleteClassInstance = useAcademicStore((s) => s.deleteClassInstance);
  const deleteAnchorEvent = useAcademicStore((s) => s.deleteAnchorEvent);
  const toggleTaskStatus = useAcademicStore((s) => s.toggleTaskStatus);
  const toggleTaskBuffer = useAcademicStore((s) => s.toggleTaskBuffer);
  const toggleTaskLock = useAcademicStore((s) => s.toggleTaskLock);
  const deleteTaskBlock = useAcademicStore((s) => s.deleteTaskBlock);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskBlock | null>(null);
  const [defaultTaskDate, setDefaultTaskDate] = useState<string | null>(
    getTodayDateKey()
  );
  const [defaultTaskSlot, setDefaultTaskSlot] = useState<TimeSlot>('MORNING');

  const [isAnchorModalOpen, setIsAnchorModalOpen] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState<AnchorEvent | null>(null);

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSchedule | null>(null);

  const [isStudyLogModalOpen, setIsStudyLogModalOpen] = useState(false);
  const [defaultStudyCourseId, setDefaultStudyCourseId] = useState<string | undefined>(
    undefined
  );

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts (Cmd/Ctrl + K, N, E, F, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInputFocused) return;
      if (
        isTaskModalOpen ||
        isAnchorModalOpen ||
        isCourseModalOpen ||
        isClassModalOpen ||
        isStudyLogModalOpen ||
        isCommandPaletteOpen
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        setEditingTask(null);
        setDefaultTaskDate(getTodayDateKey());
        setDefaultTaskSlot('MORNING');
        setIsTaskModalOpen(true);
      } else if (key === 'e') {
        e.preventDefault();
        setEditingAnchor(null);
        setIsAnchorModalOpen(true);
      } else if (key === 'c') {
        e.preventDefault();
        setEditingCourse(null);
        setIsCourseModalOpen(true);
      } else if (key === 'l') {
        e.preventDefault();
        setDefaultStudyCourseId(undefined);
        setIsStudyLogModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isTaskModalOpen,
    isAnchorModalOpen,
    isCourseModalOpen,
    isClassModalOpen,
    isStudyLogModalOpen,
    isCommandPaletteOpen,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resolveDestination = (
    overId: string
  ): {
    targetDate: string | null;
    targetSlot: TimeSlot;
    targetIndex?: number;
  } | null => {
    const cleanOverId = overId.trim();

    if (cleanOverId.startsWith('container:')) {
      if (cleanOverId === 'container:BACKLOG') {
        return { targetDate: null, targetSlot: 'MORNING' };
      }
      const parts = cleanOverId.split(':');
      const targetDate = parts[1];
      const targetSlot = (parts[2] as TimeSlot) || 'MORNING';
      return { targetDate, targetSlot };
    }

    const overTask = taskBlocks.find((t) => t.id === cleanOverId);
    if (overTask) {
      const siblingTasks = taskBlocks
        .filter(
          (t) =>
            t.scheduledDate === overTask.scheduledDate &&
            t.timeSlot === overTask.timeSlot &&
            t.id !== activeDragId
        )
        .sort((a, b) => a.order - b.order);

      const targetIndex = siblingTasks.findIndex((t) => t.id === overTask.id);
      return {
        targetDate: overTask.scheduledDate,
        targetSlot: overTask.timeSlot,
        targetIndex: targetIndex >= 0 ? targetIndex : undefined,
      };
    }

    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dragId = String(active.id);
    const overId = String(over.id);
    if (dragId === overId || overId === 'container:TRASH') return;

    // Only live-preview move for TaskBlocks (anchors & classes move on drop)
    if (dragId.startsWith('anchor:') || dragId.startsWith('class:')) return;

    const movingTask = taskBlocks.find((t) => t.id === dragId);
    if (!movingTask || movingTask.isLocked) return;

    const dest = resolveDestination(overId);
    if (!dest) return;

    if (
      movingTask.scheduledDate !== dest.targetDate ||
      movingTask.timeSlot !== dest.targetSlot
    ) {
      moveTaskBlock(dragId, dest.targetDate, dest.targetSlot, dest.targetIndex);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);
    if (dragId === overId) return;

    // Handle dropping any block onto the bottom-right Trash Zone
    if (overId === 'container:TRASH') {
      if (dragId.startsWith('anchor:')) {
        deleteAnchorEvent(dragId.slice('anchor:'.length));
      } else if (dragId.startsWith('class:')) {
        const rest = dragId.slice('class:'.length);
        const lastColon = rest.lastIndexOf(':');
        if (lastColon > 0) {
          const classId = rest.slice(0, lastColon);
          const origDate = rest.slice(lastColon + 1);
          deleteClassInstance(classId, origDate);
        }
      } else {
        deleteTaskBlock(dragId);
      }
      return;
    }

    const dest = resolveDestination(overId);
    if (!dest || !dest.targetDate) return;

    if (dragId.startsWith('anchor:')) {
      const anchorId = dragId.slice('anchor:'.length);
      moveAnchorEvent(anchorId, dest.targetDate, dest.targetSlot);
      return;
    }

    if (dragId.startsWith('class:')) {
      const rest = dragId.slice('class:'.length);
      const lastColon = rest.lastIndexOf(':');
      if (lastColon > 0) {
        const classId = rest.slice(0, lastColon);
        const origDate = rest.slice(lastColon + 1);
        moveClassInstance(classId, origDate, dest.targetDate);
      }
      return;
    }

    moveTaskBlock(dragId, dest.targetDate, dest.targetSlot, dest.targetIndex);
  };

  const activeDragTask =
    activeDragId && !activeDragId.startsWith('anchor:') && !activeDragId.startsWith('class:')
      ? taskBlocks.find((t) => t.id === activeDragId) || null
      : null;

  const activeDragAnchor =
    activeDragId && activeDragId.startsWith('anchor:')
      ? anchorEvents.find((a) => a.id === activeDragId.slice('anchor:'.length)) || null
      : null;

  const activeDragClass = (() => {
    if (!activeDragId || !activeDragId.startsWith('class:')) return null;
    const rest = activeDragId.slice('class:'.length);
    const lastColon = rest.lastIndexOf(':');
    if (lastColon <= 0) return null;
    const classId = rest.slice(0, lastColon);
    return classSchedules.find((c) => c.id === classId) || null;
  })();

  return (
    <div className="h-screen w-screen flex flex-col bg-app text-fg overflow-hidden">
      {/* Top Bar */}
      <TopBar
        onOpenNewTask={() => {
          setEditingTask(null);
          setDefaultTaskDate(getTodayDateKey());
          setDefaultTaskSlot('MORNING');
          setIsTaskModalOpen(true);
        }}
        onOpenNewAnchor={() => {
          setEditingAnchor(null);
          setIsAnchorModalOpen(true);
        }}
        onOpenNewCourse={() => {
          setEditingCourse(null);
          setIsCourseModalOpen(true);
        }}
        onOpenNewClass={() => {
          setEditingClass(null);
          setIsClassModalOpen(true);
        }}
        onOpenNewStudyLog={() => {
          setDefaultStudyCourseId(undefined);
          setIsStudyLogModalOpen(true);
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {appMode === 'KNOWLEDGE' ? (
        <KnowledgeBaseWorkspace
          onEditTask={(task) => {
            setEditingTask(task);
            setIsTaskModalOpen(true);
          }}
          onEditAnchor={(anchor) => {
            setEditingAnchor(anchor);
            setIsAnchorModalOpen(true);
          }}
        />
      ) : (
        /* 3-Column Notion Workspace */
        <DndContext
          sensors={sensors}
          collisionDetection={multiContainerCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Sidebar: Mini-Calendar, Day Logs, Courses, Deadlines */}
            {!isLeftPaneCollapsed && (
              <LeftPaneRadar
                onEditCourse={(course) => {
                  setEditingCourse(course);
                  setIsCourseModalOpen(true);
                }}
                onOpenNewCourse={() => {
                  setEditingCourse(null);
                  setIsCourseModalOpen(true);
                }}
                onEditAnchor={(anchor) => {
                  setEditingAnchor(anchor);
                  setIsAnchorModalOpen(true);
                }}
                onOpenNewAnchor={() => {
                  setEditingAnchor(null);
                  setIsAnchorModalOpen(true);
                }}
                onOpenNewClass={() => {
                  setEditingClass(null);
                  setIsClassModalOpen(true);
                }}
                onEditClass={(cls) => {
                  setEditingClass(cls);
                  setIsClassModalOpen(true);
                }}
                onOpenNewStudyLog={(courseId) => {
                  setDefaultStudyCourseId(courseId);
                  setIsStudyLogModalOpen(true);
                }}
              />
            )}

            {/* Center Workspace: Month Calendar | 7-Day Swimlane Board | Database Table */}
            <CenterPaneTimeline
              onEditTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
              onQuickAddTaskAt={(dateStr, slot) => {
                setEditingTask(null);
                setDefaultTaskDate(dateStr);
                setDefaultTaskSlot(slot);
                setIsTaskModalOpen(true);
              }}
              onEditAnchor={(anchor) => {
                setEditingAnchor(anchor);
                setIsAnchorModalOpen(true);
              }}
              onEditClass={(cls) => {
                setEditingClass(cls);
                setIsClassModalOpen(true);
              }}
              onOpenNewTask={() => {
                setEditingTask(null);
                setDefaultTaskDate(getTodayDateKey());
                setDefaultTaskSlot('MORNING');
                setIsTaskModalOpen(true);
              }}
            />

            {/* Right Sidebar: Subjects Studied (Ranked) & Upcoming / Auto-Backlog */}
            <RightPaneSRQueue
              onOpenNewStudyLog={(courseId) => {
                setDefaultStudyCourseId(courseId);
                setIsStudyLogModalOpen(true);
              }}
              onEditAnchor={(anchor) => {
                setEditingAnchor(anchor);
                setIsAnchorModalOpen(true);
              }}
              onEditTask={(task) => {
                setEditingTask(task);
                setIsTaskModalOpen(true);
              }}
            />
          </div>

          {/* Bottom-Right Trash Drop Zone while dragging any block */}
          {activeDragId && <DragTrashDropZone />}

          {/* DragOverlay */}
          <DragOverlay>
            {activeDragTask ? (
              <div className="w-[260px] opacity-95 shadow-2xl pointer-events-none">
                <TaskBlockCard
                  task={activeDragTask}
                  course={courses.find((c) => c.id === activeDragTask.courseId)}
                  linkedAnchor={anchorEvents.find(
                    (a) => a.id === activeDragTask.anchorId
                  )}
                  allTasks={taskBlocks}
                  allAnchors={anchorEvents}
                  onToggleDone={toggleTaskStatus}
                  onToggleBuffer={toggleTaskBuffer}
                  onToggleLock={toggleTaskLock}
                  onEditTask={() => {}}
                  onDeleteTask={deleteTaskBlock}
                  isOverlay
                />
              </div>
            ) : activeDragAnchor ? (
              <div className="w-[240px] opacity-95 shadow-2xl pointer-events-none card px-3 py-2 border-line-strong">
                <span className="font-mono text-[10px] uppercase text-danger mr-1.5">
                  {activeDragAnchor.type}
                </span>
                <span className="text-xs font-medium text-fg">{activeDragAnchor.title}</span>
              </div>
            ) : activeDragClass ? (
              <div className="w-[240px] opacity-95 shadow-2xl pointer-events-none card px-3 py-2 border-line-strong">
                <span className="font-mono text-[10px] text-info mr-1.5">
                  {activeDragClass.startTime}
                </span>
                <span className="text-xs font-medium text-fg">{activeDragClass.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals & Command Palette */}
      <TaskBlockModal
        isOpen={isTaskModalOpen}
        editingTask={editingTask}
        defaultDate={defaultTaskDate}
        defaultSlot={defaultTaskSlot}
        onClose={() => setIsTaskModalOpen(false)}
      />

      <AnchorEventModal
        isOpen={isAnchorModalOpen}
        editingAnchor={editingAnchor}
        onClose={() => setIsAnchorModalOpen(false)}
      />

      <CourseModal
        isOpen={isCourseModalOpen}
        editingCourse={editingCourse}
        onSelectEditCourse={(c) => setEditingCourse(c)}
        onClose={() => setIsCourseModalOpen(false)}
      />

      <ClassScheduleModal
        isOpen={isClassModalOpen}
        editingClass={editingClass}
        onSelectEditClass={(c) => setEditingClass(c)}
        onClose={() => setIsClassModalOpen(false)}
      />

      <StudyLogModal
        isOpen={isStudyLogModalOpen}
        defaultCourseId={defaultStudyCourseId}
        onClose={() => setIsStudyLogModalOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenNewTask={() => {
          setEditingTask(null);
          setDefaultTaskDate(getTodayDateKey());
          setDefaultTaskSlot('MORNING');
          setIsTaskModalOpen(true);
        }}
        onOpenNewAnchor={() => {
          setEditingAnchor(null);
          setIsAnchorModalOpen(true);
        }}
        onOpenNewCourse={() => {
          setEditingCourse(null);
          setIsCourseModalOpen(true);
        }}
        onOpenNewClass={() => {
          setEditingClass(null);
          setIsClassModalOpen(true);
        }}
        onOpenNewStudyLog={() => {
          setDefaultStudyCourseId(undefined);
          setIsStudyLogModalOpen(true);
        }}
        onEditTask={(task) => {
          setEditingTask(task);
          setIsTaskModalOpen(true);
        }}
        onEditAnchor={(anchor) => {
          setEditingAnchor(anchor);
          setIsAnchorModalOpen(true);
        }}
      />
    </div>
  );
}

export default App;
