import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarClock,
  FastForward,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { AnchorEvent, TaskBlock } from '../types/academic';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewTask: () => void;
  onOpenNewAnchor: () => void;
  onOpenNewCourse: () => void;
  onOpenNewClass: () => void;
  onOpenNewStudyLog: () => void;
  onEditTask: (task: TaskBlock) => void;
  onEditAnchor: (anchor: AnchorEvent) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenNewTask,
  onOpenNewAnchor,
  onOpenNewCourse,
  onOpenNewClass,
  onOpenNewStudyLog,
  onEditTask,
  onEditAnchor,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const rippleMode = useAcademicStore((s) => s.rippleMode);
  const theme = useAcademicStore((s) => s.theme);
  const rippleMissedTasks = useAcademicStore((s) => s.rippleMissedTasks);
  const setRippleMode = useAcademicStore((s) => s.setRippleMode);
  const toggleTheme = useAcademicStore((s) => s.toggleTheme);
  const jumpToToday = useAcademicStore((s) => s.jumpToToday);
  const clearAllData = useAcademicStore((s) => s.clearAllData);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands = useMemo(() => {
    const items: {
      id: string;
      category: string;
      label: string;
      sublabel?: string;
      icon: React.ReactNode;
      action: () => void;
    }[] = [
      {
        id: 'act-new-task',
        category: 'Create',
        label: 'New Task Block',
        sublabel: 'N',
        icon: <Plus className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onOpenNewTask();
        },
      },
      {
        id: 'act-new-anchor',
        category: 'Create',
        label: 'New Exam / Deadline',
        sublabel: 'E',
        icon: <Plus className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onOpenNewAnchor();
        },
      },
      {
        id: 'act-new-course',
        category: 'Create',
        label: 'Manage Courses & Syllabi',
        sublabel: 'C',
        icon: <Plus className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onOpenNewCourse();
        },
      },
      {
        id: 'act-new-class',
        category: 'Schedule',
        label: 'Add Weekly Repeating Class',
        icon: <CalendarClock className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onOpenNewClass();
        },
      },
      {
        id: 'act-log-study',
        category: 'Study Log',
        label: 'Log Study Session (Course or Outside Topic)',
        sublabel: 'L',
        icon: <BookOpen className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onOpenNewStudyLog();
        },
      },
      {
        id: 'act-ripple-missed',
        category: 'Schedule',
        label: 'Ripple Missed Tasks Forward',
        sublabel: rippleMode,
        icon: <FastForward className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          rippleMissedTasks();
          onClose();
        },
      },
      {
        id: 'act-toggle-mode',
        category: 'Schedule',
        label: `Switch Ripple Mode to ${
          rippleMode === 'BUFFER_FIRST' ? 'Cascade' : 'Buffer'
        }`,
        icon: <FastForward className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          setRippleMode(rippleMode === 'BUFFER_FIRST' ? 'CASCADE' : 'BUFFER_FIRST');
          onClose();
        },
      },
      {
        id: 'act-toggle-theme',
        category: 'Theme',
        label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        icon:
          theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-muted" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-muted" />
          ),
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'act-jump-today',
        category: 'Navigation',
        label: 'Jump to Today',
        icon: <Calendar className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          jumpToToday();
          onClose();
        },
      },
      {
        id: 'act-clear-all',
        category: 'Workspace',
        label: 'Clear All Workspace Data',
        icon: <Trash2 className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          if (
            window.confirm('Delete all courses, deadlines, tasks, and flashcards?')
          ) {
            clearAllData();
          }
          onClose();
        },
      },
    ];

    for (const anchor of anchorEvents) {
      items.push({
        id: `anchor-${anchor.id}`,
        category: 'Deadline',
        label: anchor.title,
        sublabel: `${anchor.type} · ${anchor.dueDate}`,
        icon: <Calendar className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onEditAnchor(anchor);
        },
      });
    }

    for (const task of taskBlocks) {
      items.push({
        id: `task-${task.id}`,
        category: 'Task',
        label: task.title,
        sublabel: `${task.scheduledDate || 'Backlog'} · ${task.estimatedMinutes}m`,
        icon: <Plus className="w-3.5 h-3.5 text-muted" />,
        action: () => {
          onClose();
          onEditTask(task);
        },
      });
    }

    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 14);
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.sublabel && i.sublabel.toLowerCase().includes(q))
    );
  }, [
    query,
    rippleMode,
    theme,
    anchorEvents,
    taskBlocks,
    onClose,
    onOpenNewTask,
    onOpenNewAnchor,
    onOpenNewCourse,
    onOpenNewClass,
    onOpenNewStudyLog,
    onEditAnchor,
    onEditTask,
    rippleMissedTasks,
    setRippleMode,
    toggleTheme,
    jumpToToday,
    clearAllData,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        commands.length > 0 ? (prev + 1) % commands.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        commands.length > 0
          ? (prev - 1 + commands.length) % commands.length
          : 0
      );
    } else if (e.key === 'Enter' && commands[selectedIndex]) {
      e.preventDefault();
      commands[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="px-3.5 py-2.5 border-b border-line flex items-center gap-2.5">
          <Search className="w-3.5 h-3.5 text-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent text-xs text-fg placeholder:text-subtle focus:outline-none"
          />
          <button onClick={onClose} className="icon-btn">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {commands.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">No results</div>
          ) : (
            commands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full px-2.5 py-2 rounded-md flex items-center justify-between gap-3 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-elev text-fg'
                    : 'text-muted hover:bg-elev/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {cmd.icon}
                  <span className="text-xs truncate">{cmd.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cmd.sublabel && (
                    <span className="font-mono text-[10px] text-subtle">
                      {cmd.sublabel}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-subtle">
                    {cmd.category}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
