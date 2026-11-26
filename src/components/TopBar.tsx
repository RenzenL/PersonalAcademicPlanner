import React, { useRef } from 'react';
import {
  BookOpen,
  CalendarClock,
  Download,
  LayoutGrid,
  Menu,
  Moon,
  Network,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAcademicStore } from '../store/useAcademicStore';
import { diffDays, getTodayDateKey } from '../utils/dateUtils';
import { evaluateDayDiagnostics } from '../engines/rippleEngine';
import { formatHours } from './ui';

interface TopBarProps {
  onOpenNewTask: () => void;
  onOpenNewAnchor: () => void;
  onOpenNewCourse: () => void;
  onOpenNewClass: () => void;
  onOpenNewStudyLog: () => void;
  onOpenCommandPalette: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenNewTask,
  onOpenNewAnchor,
  onOpenNewCourse,
  onOpenNewClass,
  onOpenNewStudyLog,
  onOpenCommandPalette,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courses = useAcademicStore((s) => s.courses);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const srCards = useAcademicStore((s) => s.srCards);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const studyLogs = useAcademicStore((s) => s.studyLogs);
  const notes = useAcademicStore((s) => s.notes);
  const appMode = useAcademicStore((s) => s.appMode);
  const setAppMode = useAcademicStore((s) => s.setAppMode);
  const theme = useAcademicStore((s) => s.theme);
  const toggleTheme = useAcademicStore((s) => s.toggleTheme);
  const isLeftPaneCollapsed = useAcademicStore((s) => s.isLeftPaneCollapsed);
  const setLeftPaneCollapsed = useAcademicStore((s) => s.setLeftPaneCollapsed);
  const isRightPaneCollapsed = useAcademicStore((s) => s.isRightPaneCollapsed);
  const setRightPaneCollapsed = useAcademicStore((s) => s.setRightPaneCollapsed);
  const dailyCapacityMinutes = useAcademicStore((s) => s.dailyCapacityMinutes);
  const setDailyCapacityMinutes = useAcademicStore((s) => s.setDailyCapacityMinutes);
  const rippleMode = useAcademicStore((s) => s.rippleMode);
  const setRippleMode = useAcademicStore((s) => s.setRippleMode);
  const rippleMissedTasks = useAcademicStore((s) => s.rippleMissedTasks);
  const exportBackupJSON = useAcademicStore((s) => s.exportBackupJSON);
  const importBackupJSON = useAcademicStore((s) => s.importBackupJSON);
  const loadSampleTemplate = useAcademicStore((s) => s.loadSampleTemplate);
  const clearAllData = useAcademicStore((s) => s.clearAllData);

  const todayKey = getTodayDateKey();

  const missedCount = taskBlocks.filter(
    (t) =>
      !t.isBuffer &&
      t.status !== 'DONE' &&
      (t.status === 'MISSED' ||
        (t.scheduledDate !== null && diffDays(t.scheduledDate, todayKey) > 0))
  ).length;

  const today = evaluateDayDiagnostics(
    todayKey,
    taskBlocks,
    anchorEvents,
    dailyCapacityMinutes
  );

  const isEmpty =
    courses.length === 0 &&
    anchorEvents.length === 0 &&
    taskBlocks.length === 0 &&
    srCards.length === 0 &&
    classSchedules.length === 0 &&
    studyLogs.length === 0 &&
    notes.length === 0;

  const handleExport = () => {
    const blob = new Blob([exportBackupJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kronos-backup-${todayKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importBackupJSON(String(reader.result || ''));
      if (!res.ok) alert(`Import failed: ${res.error}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 border-b border-line bg-app px-4 flex items-center justify-between gap-4 shrink-0">
      {/* Left: menu · brand · search */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setLeftPaneCollapsed(!isLeftPaneCollapsed)}
          className="icon-btn"
          title="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="font-mono text-sm font-semibold tracking-[0.12em] text-fg">
          KRONOS
        </span>
        <div className="w-px h-5 bg-line mx-1" />
        {/* Planner vs Knowledge Base Toggle */}
        <div className="seg !p-0.5">
          <button
            type="button"
            onClick={() => setAppMode('PLANNER')}
            className={`seg-item inline-flex items-center gap-1.5 ${
              appMode === 'PLANNER' ? 'is-active' : ''
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Planner</span>
          </button>
          <button
            type="button"
            onClick={() => setAppMode('KNOWLEDGE')}
            className={`seg-item inline-flex items-center gap-1.5 ${
              appMode === 'KNOWLEDGE' ? 'is-active' : ''
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
          </button>
        </div>
        <div className="w-px h-5 bg-line mx-1 hidden md:block" />
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-elev transition-colors"
          title="Search & commands"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="font-mono text-[10px] px-1 py-px rounded border border-line text-subtle">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: create · ripple · utilities */}
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto py-1">
        <button onClick={onOpenNewCourse} className="btn">
          <Plus className="w-3.5 h-3.5" /> Course
        </button>
        <button onClick={onOpenNewClass} className="btn" title="Add recurring weekly class">
          <CalendarClock className="w-3.5 h-3.5" /> Class
        </button>
        <button onClick={onOpenNewAnchor} className="btn">
          <Plus className="w-3.5 h-3.5" /> Deadline
        </button>
        <button onClick={onOpenNewTask} className="btn">
          <Plus className="w-3.5 h-3.5" /> Task
        </button>
        <button onClick={onOpenNewStudyLog} className="btn-solid" title="Log study session (L)">
          <BookOpen className="w-3.5 h-3.5" /> Log Study
        </button>

        <div className="flex items-center seg !p-0.5 ml-1">
          <button
            onClick={() => rippleMissedTasks()}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-fg bg-panel shadow-sm"
            title="Move missed / overdue tasks forward (into buffers first, or cascade)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Ripple Shift
            {missedCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 rounded-full bg-danger text-white">
                {missedCount}
              </span>
            )}
          </button>
          <button
            onClick={() =>
              setRippleMode(rippleMode === 'BUFFER_FIRST' ? 'CASCADE' : 'BUFFER_FIRST')
            }
            className="px-2 py-1 font-mono text-[10px] uppercase text-muted hover:text-fg"
            title="Toggle ripple strategy"
          >
            {rippleMode === 'BUFFER_FIRST' ? 'buffer' : 'cascade'}
          </button>
        </div>

        <div
          className={`hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] ${
            today.isOverCapacity ? 'border-danger/50 text-danger' : 'border-line text-muted'
          }`}
          title="Today's load / daily capacity"
        >
          <span className="text-fg font-semibold">{formatHours(today.totalMinutes)}</span>
          <span>/</span>
          <select
            value={dailyCapacityMinutes}
            onChange={(e) => setDailyCapacityMinutes(Number(e.target.value))}
            className="bg-transparent focus:outline-none cursor-pointer"
          >
            {[240, 300, 360, 420, 480, 540].map((m) => (
              <option key={m} value={m}>
                {m / 60}h
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-line mx-1 shrink-0" />

        {isEmpty ? (
          <button onClick={loadSampleTemplate} className="icon-btn" title="Load sample template">
            <Sparkles className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => {
              if (window.confirm('Delete all courses, deadlines, tasks and flashcards?')) {
                clearAllData();
              }
            }}
            className="icon-btn hover:!text-danger"
            title="Clear workspace"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={handleExport} className="icon-btn" title="Export JSON">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="icon-btn" title="Import JSON">
          <Upload className="w-4 h-4" />
        </button>

        <button
          onClick={() => setRightPaneCollapsed(!isRightPaneCollapsed)}
          className={`icon-btn ${!isRightPaneCollapsed ? 'text-fg bg-elev' : ''}`}
          title="Toggle Subjects Studied & Backlog pane"
        >
          <PanelRight className="w-4 h-4" />
        </button>

        {/* Light / Dark switch */}
        <button
          onClick={toggleTheme}
          role="switch"
          aria-checked={theme === 'dark'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="relative ml-1 w-14 h-7 rounded-full bg-elev border border-line flex items-center px-1 shrink-0 transition-colors"
        >
          <Sun className="w-3.5 h-3.5 text-muted absolute left-1.5" />
          <Moon className="w-3.5 h-3.5 text-muted absolute right-1.5" />
          <span
            className={`relative z-10 w-5 h-5 rounded-full bg-panel border border-line-strong shadow flex items-center justify-center transition-transform duration-200 ${
              theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
            }`}
          >
            {theme === 'dark' ? (
              <Moon className="w-3 h-3 text-fg" />
            ) : (
              <Sun className="w-3 h-3 text-fg" />
            )}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
      </div>
    </header>
  );
};
