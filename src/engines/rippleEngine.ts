import {
  AnchorEvent,
  RippleActionLog,
  RippleMode,
  TaskBlock,
  TimeSlot,
} from '../types/academic';
import { addDays, diffDays, toDateKey } from '../utils/dateUtils';

const SLOT_ORDER: Record<TimeSlot, number> = {
  MORNING: 0,
  AFTERNOON: 1,
  EVENING: 2,
};

export interface TaskGuardrailStatus {
  taskId: string;
  exceedsAnchorDeadline: boolean;
  linkedAnchor?: AnchorEvent;
   daysPastAnchor: number;
  hasDependencyViolation: boolean;
  parentTask?: TaskBlock;
}

export interface DayDiagnostics {
  date: string;
  totalMinutes: number;
  nonBufferMinutes: number;
  bufferMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  isOverCapacity: boolean;
  overageMinutes: number;
  deadlineViolationTasks: TaskBlock[];
  dependencyViolationTasks: TaskBlock[];
  hasAnyWarning: boolean;
}

/**
 * Evaluates guardrails for a single TaskBlock:
 * 1. Pushed past linked AnchorEvent.dueDate
 * 2. Scheduled before its dependencyId parent task
 */
export function evaluateTaskGuardrails(
  task: TaskBlock,
  allTasks: TaskBlock[],
  anchorEvents: AnchorEvent[]
): TaskGuardrailStatus {
  let exceedsAnchorDeadline = false;
  let linkedAnchor: AnchorEvent | undefined;
  let daysPastAnchor = 0;

  if (task.anchorId && task.scheduledDate && task.status !== 'DONE') {
    linkedAnchor = anchorEvents.find((a) => a.id === task.anchorId);
    if (linkedAnchor) {
      const anchorDate = toDateKey(linkedAnchor.dueDate);
      const delta = diffDays(anchorDate, task.scheduledDate);
      if (delta > 0) {
        exceedsAnchorDeadline = true;
        daysPastAnchor = delta;
      }
    }
  }

  let hasDependencyViolation = false;
  let parentTask: TaskBlock | undefined;

  if (task.dependencyId && task.scheduledDate) {
    parentTask = allTasks.find((t) => t.id === task.dependencyId);
    if (parentTask && parentTask.status !== 'DONE') {
      if (!parentTask.scheduledDate) {
        hasDependencyViolation = true;
      } else {
        const d = diffDays(parentTask.scheduledDate, task.scheduledDate);
        if (d < 0) {
          hasDependencyViolation = true;
        } else if (
          d === 0 &&
          SLOT_ORDER[task.timeSlot] < SLOT_ORDER[parentTask.timeSlot]
        ) {
          hasDependencyViolation = true;
        }
      }
    }
  }

  return {
    taskId: task.id,
    exceedsAnchorDeadline,
    linkedAnchor,
    daysPastAnchor,
    hasDependencyViolation,
    parentTask,
  };
}

/**
 * Evaluates full capacity & guardrail diagnostics for a specific YYYY-MM-DD day column.
 */
export function evaluateDayDiagnostics(
  dateStr: string,
  allTasks: TaskBlock[],
  anchorEvents: AnchorEvent[],
  dailyCapacityMinutes: number
): DayDiagnostics {
  const dayTasks = allTasks.filter((t) => t.scheduledDate === dateStr);

  const nonBufferMinutes = dayTasks
    .filter((t) => !t.isBuffer)
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const bufferMinutes = dayTasks
    .filter((t) => t.isBuffer)
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const totalMinutes = nonBufferMinutes + bufferMinutes;
  const isOverCapacity = totalMinutes > dailyCapacityMinutes;
  const overageMinutes = Math.max(0, totalMinutes - dailyCapacityMinutes);
  const utilizationPercent =
    dailyCapacityMinutes > 0
      ? Math.round((totalMinutes / dailyCapacityMinutes) * 100)
      : 0;

  const deadlineViolationTasks: TaskBlock[] = [];
  const dependencyViolationTasks: TaskBlock[] = [];

  for (const task of dayTasks) {
    const status = evaluateTaskGuardrails(task, allTasks, anchorEvents);
    if (status.exceedsAnchorDeadline) {
      deadlineViolationTasks.push(task);
    }
    if (status.hasDependencyViolation) {
      dependencyViolationTasks.push(task);
    }
  }

  return {
    date: dateStr,
    totalMinutes,
    nonBufferMinutes,
    bufferMinutes,
    capacityMinutes: dailyCapacityMinutes,
    utilizationPercent,
    isOverCapacity,
    overageMinutes,
    deadlineViolationTasks,
    dependencyViolationTasks,
    hasAnyWarning:
      isOverCapacity ||
      deadlineViolationTasks.length > 0 ||
      dependencyViolationTasks.length > 0,
  };
}

/**
 * Collects all downstream dependent task IDs (transitive closure of `dependencyId`)
 * in topological order.
 */
export function getDownstreamDependents(
  rootTaskIds: string[],
  allTasks: TaskBlock[]
): string[] {
  const visited = new Set<string>(rootTaskIds);
  const queue = [...rootTaskIds];
  const downstreamOrder: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = allTasks.filter(
      (t) => t.dependencyId === currentId && t.status !== 'DONE'
    );
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        downstreamOrder.push(child.id);
        queue.push(child.id);
      }
    }
  }

  return downstreamOrder;
}

/**
 * Internal helper that attempts to absorb a task into the earliest available
 * future Buffer Block (`isBuffer: true`) on or after `minDateStr`.
 * If a buffer block has larger capacity than `task.estimatedMinutes`, it shrinks
 * the buffer block's remaining minutes; otherwise it replaces/consumes the buffer block.
 */
function tryAbsorbIntoBuffer(
  taskToMove: TaskBlock,
  workingTasks: TaskBlock[],
  minDateStr: string
): { absorbed: boolean; bufferUsedId?: string; targetDate?: string } {
  // Find candidate buffer blocks scheduled on or after minDateStr
  const candidateBuffers = workingTasks
    .filter(
      (b) =>
        b.isBuffer &&
        b.status !== 'DONE' &&
        b.scheduledDate !== null &&
        diffDays(minDateStr, b.scheduledDate) >= 0 &&
        b.estimatedMinutes >= Math.min(30, taskToMove.estimatedMinutes)
    )
    .sort((a, b) => {
      const dateDiff = diffDays(b.scheduledDate!, a.scheduledDate!);
      if (dateDiff !== 0) return -dateDiff;
      return SLOT_ORDER[a.timeSlot] - SLOT_ORDER[b.timeSlot];
    });

  if (candidateBuffers.length === 0) {
    return { absorbed: false };
  }

  const chosenBuffer = candidateBuffers[0];
  const bufferDate = chosenBuffer.scheduledDate!;
  const bufferSlot = chosenBuffer.timeSlot;

  // Move task into the buffer's date and time slot
  const taskIdx = workingTasks.findIndex((t) => t.id === taskToMove.id);
  if (taskIdx === -1) return { absorbed: false };

  workingTasks[taskIdx] = {
    ...workingTasks[taskIdx],
    scheduledDate: bufferDate,
    timeSlot: bufferSlot,
    status: workingTasks[taskIdx].status === 'MISSED' ? 'TODO' : workingTasks[taskIdx].status,
  };

  // Reduce or remove the buffer block so total day capacity stays balanced
  const bufferIdx = workingTasks.findIndex((t) => t.id === chosenBuffer.id);
  if (bufferIdx !== -1) {
    const remainingBufferMins =
      workingTasks[bufferIdx].estimatedMinutes - taskToMove.estimatedMinutes;
    if (remainingBufferMins >= 25) {
      workingTasks[bufferIdx] = {
        ...workingTasks[bufferIdx],
        estimatedMinutes: remainingBufferMins,
        title: `${workingTasks[bufferIdx].title.replace(/\s*\(Partial\)$/, '')} (Partial)`,
      };
    } else {
      // Buffer block completely absorbed by the task
      workingTasks.splice(bufferIdx, 1);
    }
  }

  return {
    absorbed: true,
    bufferUsedId: chosenBuffer.id,
    targetDate: bufferDate,
  };
}

/**
 * Core Ripple & Cascade Engine:
 * Shifts a target set of tasks forward by `daysDelta` days (or from `minStartDate`),
 * optionally absorbing into Buffer Blocks first (`mode === 'BUFFER_FIRST'`),
 * and automatically cascading to downstream dependent tasks (`dependencyId`)
 * while keeping `AnchorEvents` fixed.
 */
export function executeModularRipple(params: {
  tasks: TaskBlock[];
  anchorEvents: AnchorEvent[];
  targetTaskIds: string[];
  daysDelta: number;
  mode: RippleMode;
  dailyCapacityMinutes: number;
  minTargetDate?: string;
  actionLabel?: string;
}): { updatedTasks: TaskBlock[]; log: RippleActionLog } {
  const {
    tasks,
    anchorEvents,
    targetTaskIds,
    daysDelta,
    mode,
    dailyCapacityMinutes,
    minTargetDate,
    actionLabel = 'Ripple Shift',
  } = params;

  const workingTasks: TaskBlock[] = tasks.map((t) => ({ ...t }));
  const shiftedTaskIds: string[] = [];
  const absorbedByBufferIds: string[] = [];

  // Sort target tasks chronologically so earlier tasks claim earlier buffers
  const targetTasksSorted = targetTaskIds
    .map((id) => workingTasks.find((t) => t.id === id))
    .filter((t): t is TaskBlock => Boolean(t && !t.isBuffer && t.status !== 'DONE'))
    .sort((a, b) => {
      if (!a.scheduledDate || !b.scheduledDate) return 0;
      const d = diffDays(b.scheduledDate, a.scheduledDate);
      if (d !== 0) return -d;
      return SLOT_ORDER[a.timeSlot] - SLOT_ORDER[b.timeSlot];
    });

  for (const originalTask of targetTasksSorted) {
    const currentTask = workingTasks.find((t) => t.id === originalTask.id);
    if (!currentTask || !currentTask.scheduledDate) continue;

    const baseDate =
      minTargetDate && diffDays(currentTask.scheduledDate, minTargetDate) > 0
        ? minTargetDate
        : addDays(currentTask.scheduledDate, Math.max(1, daysDelta));

    if (mode === 'BUFFER_FIRST') {
      const absorption = tryAbsorbIntoBuffer(currentTask, workingTasks, baseDate);
      if (absorption.absorbed && absorption.bufferUsedId) {
        shiftedTaskIds.push(currentTask.id);
        absorbedByBufferIds.push(absorption.bufferUsedId);
        continue;
      }
    }

    // Standard shift forward by daysDelta (or to baseDate)
    const idx = workingTasks.findIndex((t) => t.id === currentTask.id);
    if (idx !== -1) {
      workingTasks[idx] = {
        ...workingTasks[idx],
        scheduledDate: baseDate,
        status: workingTasks[idx].status === 'MISSED' ? 'TODO' : workingTasks[idx].status,
      };
      shiftedTaskIds.push(currentTask.id);
    }
  }

  // Cascade downstream dependent tasks (`dependencyId`)
  // Any task whose parent was moved must either shift by `daysDelta` (in CASCADE mode)
  // or at minimum be pushed so it never precedes its parent task.
  const downstreamIds = getDownstreamDependents(shiftedTaskIds, workingTasks);

  for (const depId of downstreamIds) {
    const depIdx = workingTasks.findIndex((t) => t.id === depId);
    if (depIdx === -1) continue;
    const depTask = workingTasks[depIdx];
    if (!depTask.scheduledDate || depTask.status === 'DONE') continue;

    const parentTask = workingTasks.find((t) => t.id === depTask.dependencyId);
    if (!parentTask || !parentTask.scheduledDate) continue;

    const gapToParent = diffDays(parentTask.scheduledDate, depTask.scheduledDate);

    if (mode === 'CASCADE' && !targetTaskIds.includes(depTask.id)) {
      // Shift downstream dependent task forward to preserve dependency order
      const candidateDate = addDays(depTask.scheduledDate, Math.max(1, daysDelta));
      const finalDate =
        diffDays(parentTask.scheduledDate, candidateDate) < 0
          ? addDays(parentTask.scheduledDate, 1)
          : candidateDate;

      workingTasks[depIdx] = {
        ...depTask,
        scheduledDate: finalDate,
      };
      if (!shiftedTaskIds.includes(depTask.id)) {
        shiftedTaskIds.push(depTask.id);
      }
    } else if (gapToParent < 0) {
      // Even in BUFFER_FIRST mode, if parent moved past child, push child to parent's date or +1d
      const pushedDate =
        SLOT_ORDER[depTask.timeSlot] > SLOT_ORDER[parentTask.timeSlot]
          ? parentTask.scheduledDate
          : addDays(parentTask.scheduledDate, 1);

      workingTasks[depIdx] = {
        ...depTask,
        scheduledDate: pushedDate,
      };
      if (!shiftedTaskIds.includes(depTask.id)) {
        shiftedTaskIds.push(depTask.id);
      }
    }
  }

  // Evaluate post-shift guardrails across affected dates
  const affectedDates = new Set<string>();
  const deadlineViolations: string[] = [];
  const capacityOverloads: string[] = [];

  for (const id of shiftedTaskIds) {
    const t = workingTasks.find((item) => item.id === id);
    if (t?.scheduledDate) {
      affectedDates.add(t.scheduledDate);
      const guardrail = evaluateTaskGuardrails(t, workingTasks, anchorEvents);
      if (guardrail.exceedsAnchorDeadline && guardrail.linkedAnchor) {
        deadlineViolations.push(
          `"${t.title}" exceeds ${guardrail.linkedAnchor.title} (${toDateKey(
            guardrail.linkedAnchor.dueDate
          )})`
        );
      }
    }
  }

  for (const dateStr of affectedDates) {
    const diag = evaluateDayDiagnostics(
      dateStr,
      workingTasks,
      anchorEvents,
      dailyCapacityMinutes
    );
    if (diag.isOverCapacity) {
      capacityOverloads.push(
        `${dateStr} (${diag.totalMinutes}/${dailyCapacityMinutes} mins)`
      );
    }
  }

  const summaryParts = [
    `${actionLabel}: Shifted ${shiftedTaskIds.length} task${
      shiftedTaskIds.length === 1 ? '' : 's'
    }`,
  ];
  if (absorbedByBufferIds.length > 0) {
    summaryParts.push(
      `${absorbedByBufferIds.length} absorbed by Buffer Block${
        absorbedByBufferIds.length === 1 ? '' : 's'
      }`
    );
  }
  if (deadlineViolations.length > 0) {
    summaryParts.push(`${deadlineViolations.length} deadline guardrail alert(s)`);
  }

  return {
    updatedTasks: workingTasks,
    log: {
      timestamp: new Date().toISOString(),
      summary: summaryParts.join(' • '),
      shiftedTaskIds,
      absorbedByBufferIds,
      deadlineViolations,
      capacityOverloads,
    },
  };
}

/**
 * Day Column Action: Shifts all non-completed, non-buffer tasks on `dateStr` forward by `+daysDelta` days.
 */
export function shiftDayColumnTasks(
  tasks: TaskBlock[],
  anchorEvents: AnchorEvent[],
  dateStr: string,
  daysDelta: number,
  mode: RippleMode,
  dailyCapacityMinutes: number
): { updatedTasks: TaskBlock[]; log: RippleActionLog } {
  const dayTargetIds = tasks
    .filter(
      (t) =>
        t.scheduledDate === dateStr &&
        t.status !== 'DONE' &&
        !t.isBuffer
    )
    .map((t) => t.id);

  return executeModularRipple({
    tasks,
    anchorEvents,
    targetTaskIds: dayTargetIds,
    daysDelta,
    mode,
    dailyCapacityMinutes,
    actionLabel: `Shift Day (${dateStr} +${daysDelta}d)`,
  });
}

/**
 * Global Action: Finds all tasks marked `MISSED` or overdue (`scheduledDate < todayDateStr` and `status !== 'DONE'`)
 * and ripples them into today/future buffer slots or cascades downstream tasks.
 */
export function rippleAllMissedTasks(
  tasks: TaskBlock[],
  anchorEvents: AnchorEvent[],
  todayDateStr: string,
  mode: RippleMode,
  dailyCapacityMinutes: number
): { updatedTasks: TaskBlock[]; log: RippleActionLog } {
  const missedTaskIds = tasks
    .filter(
      (t) =>
        !t.isBuffer &&
        t.status !== 'DONE' &&
        (t.status === 'MISSED' ||
          (t.scheduledDate !== null && diffDays(t.scheduledDate, todayDateStr) > 0))
    )
    .map((t) => t.id);

  return executeModularRipple({
    tasks,
    anchorEvents,
    targetTaskIds: missedTaskIds,
    daysDelta: 1,
    mode,
    dailyCapacityMinutes,
    minTargetDate: todayDateStr,
    actionLabel: `Global Ripple Missed Tasks (${mode === 'BUFFER_FIRST' ? 'Buffer Absorption' : 'Cascade'})`,
  });
}
