import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  ExternalLink,
  FastForward,
  Lock,
  MoreVertical,
  Pencil,
  Shield,
  Trash2,
  Unlock,
} from 'lucide-react';
import { AnchorEvent, Course, TaskBlock } from '../types/academic';
import { evaluateTaskGuardrails } from '../engines/rippleEngine';
import { formatShortDate } from '../utils/dateUtils';
import { ActionIcon, Checkbox, Dot } from './ui';

interface TaskBlockCardProps {
  task: TaskBlock;
  course?: Course;
  linkedAnchor?: AnchorEvent;
  allTasks: TaskBlock[];
  allAnchors: AnchorEvent[];
  onToggleDone: (taskId: string) => void;
  onToggleBuffer: (taskId: string) => void;
  onToggleLock?: (taskId: string) => void;
  onEditTask: (task: TaskBlock) => void;
  onDeleteTask: (taskId: string) => void;
  onShiftTaskCascade?: (taskId: string) => void;
  compact?: boolean;
  isOverlay?: boolean;
}

export const TaskBlockCard: React.FC<TaskBlockCardProps> = ({
  task,
  course,
  linkedAnchor,
  allTasks,
  allAnchors,
  onToggleDone,
  onToggleBuffer,
  onToggleLock,
  onEditTask,
  onDeleteTask,
  onShiftTaskCascade,
  compact = false,
  isOverlay = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { type: 'TASK_BLOCK', task },
      disabled: Boolean(task.isLocked),
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const guardrails = evaluateTaskGuardrails(task, allTasks, allAnchors);
  const isDone = task.status === 'DONE';
  const isMissed = task.status === 'MISSED' && !isDone;
  const hasViolation =
    guardrails.exceedsAnchorDeadline || guardrails.hasDependencyViolation;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEditTask(task)}
      className={`card card-glow group relative p-2.5 select-none ${
        task.isLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        isOverlay ? 'is-active rotate-[1.5deg]' : ''
      } ${isDragging ? 'opacity-30' : ''} ${
        hasViolation ? '!border-danger/60' : ''
      } ${task.isBuffer ? 'border-dashed' : ''}`}
    >
      {/* Row 1: checkbox · title · kebab */}
      <div className="flex items-start gap-2">
        <div className="pt-px">
          <Checkbox checked={isDone} onToggle={() => onToggleDone(task.id)} />
        </div>
        <p
          className={`flex-1 min-w-0 text-[13px] leading-snug break-words ${
            isDone ? 'line-through text-subtle' : task.isBuffer ? 'text-muted italic' : 'text-fg'
          }`}
        >
          {task.title}
        </p>
        <ActionIcon title="Open details" onClick={() => onEditTask(task)}>
          <MoreVertical className="w-3.5 h-3.5" />
        </ActionIcon>
      </div>

      {/* Row 2: meta · hover actions · duration */}
      <div className="mt-2 flex items-center gap-1.5 min-h-[20px]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {course && (
            <span className="flex items-center gap-1 mono-tag text-muted shrink-0">
              <Dot color={course.colorHex} className="!w-1.5 !h-1.5" />
              {course.code}
            </span>
          )}
          {task.isBuffer && <span className="pill">buffer</span>}
          {task.isLocked && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-warn" title="Locked (un-draggable)">
              <Lock className="w-2.5 h-2.5" />
            </span>
          )}
          {isMissed && <span className="pill !text-warn !border-warn/40">missed</span>}
          {!compact && linkedAnchor && !hasViolation && (
            <span className="text-[10px] text-subtle truncate">→ {linkedAnchor.title}</span>
          )}
        </div>

        <div className="hidden group-hover:flex items-center -my-1">
          {task.resourceLink && (
            <a
              href={task.resourceLink}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md text-muted hover:text-fg hover:bg-elev"
              title="Open resource"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {onToggleLock && (
            <ActionIcon
              title={task.isLocked ? 'Unlock (allow dragging)' : 'Lock (prevent dragging)'}
              onClick={() => onToggleLock(task.id)}
            >
              {task.isLocked ? (
                <Lock className="w-3 h-3 text-warn" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </ActionIcon>
          )}
          <ActionIcon
            title={task.isBuffer ? 'Unmark buffer block' : 'Mark as buffer block'}
            onClick={() => onToggleBuffer(task.id)}
          >
            <Shield className={`w-3 h-3 ${task.isBuffer ? 'text-fg' : ''}`} />
          </ActionIcon>
          {onShiftTaskCascade && task.scheduledDate && !isDone && !task.isBuffer && (
            <ActionIcon title="Shift +1 day (cascade)" onClick={() => onShiftTaskCascade(task.id)}>
              <FastForward className="w-3 h-3" />
            </ActionIcon>
          )}
          <ActionIcon title="Edit" onClick={() => onEditTask(task)}>
            <Pencil className="w-3 h-3" />
          </ActionIcon>
          <ActionIcon title="Delete" danger onClick={() => onDeleteTask(task.id)}>
            <Trash2 className="w-3 h-3" />
          </ActionIcon>
        </div>

        <span className="font-mono text-[11px] text-muted shrink-0">
          {task.estimatedMinutes}m
        </span>
      </div>

      {/* Guardrail warnings */}
      {guardrails.exceedsAnchorDeadline && guardrails.linkedAnchor && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-danger">
          <AlertCircle className="w-3 h-3 shrink-0" />
          +{guardrails.daysPastAnchor}d past {formatShortDate(guardrails.linkedAnchor.dueDate)} deadline
        </div>
      )}
      {guardrails.hasDependencyViolation && guardrails.parentTask && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-danger">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">before “{guardrails.parentTask.title}”</span>
        </div>
      )}
    </div>
  );
};
