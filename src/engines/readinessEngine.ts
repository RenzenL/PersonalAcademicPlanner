import { AnchorEvent, SpacedRepetitionCard, TaskBlock } from '../types/academic';
import { computeCardMastery } from './sm2Engine';

export interface AnchorReadinessReport {
  anchorId: string;
  readinessPercent: number; // 0 to 100
  taskCompletionRatio: number; // 0 to 1
  completedTasksCount: number;
  totalTasksCount: number;
  srMasteryAverage: number; // 0 to 1
  linkedCardsCount: number;
  totalEstimatedMinutes: number;
  remainingMinutes: number;
}

/**
 * Calculates live Exam/Assignment Readiness % for an AnchorEvent based on the exact specification:
 * Readiness = (Completed linked TaskBlocks / Total linked TaskBlocks) * 0.6
 *           + (Average Spaced Repetition mastery of linked cards) * 0.4
 */
export function calculateAnchorReadiness(
  anchor: AnchorEvent,
  allTasks: TaskBlock[],
  allCards: SpacedRepetitionCard[]
): AnchorReadinessReport {
  const linkedTasks = allTasks.filter(
    (t) => t.anchorId === anchor.id && !t.isBuffer
  );
  const completedTasks = linkedTasks.filter((t) => t.status === 'DONE');

  const totalTasksCount = linkedTasks.length;
  const completedTasksCount = completedTasks.length;

  const taskCompletionRatio =
    totalTasksCount > 0 ? completedTasksCount / totalTasksCount : anchor.completed ? 1 : 0;

  const linkedCards = allCards.filter((c) => c.anchorId === anchor.id);
  const linkedCardsCount = linkedCards.length;

  const srMasteryAverage =
    linkedCardsCount > 0
      ? linkedCards.reduce((sum, card) => sum + computeCardMastery(card), 0) /
        linkedCardsCount
      : taskCompletionRatio; // If an assignment has no SR cards linked, mirror task progress so it can reach 100%

  const rawReadiness = anchor.completed
    ? 1
    : taskCompletionRatio * 0.6 + srMasteryAverage * 0.4;

  const readinessPercent = Math.min(100, Math.max(0, Math.round(rawReadiness * 100)));

  const totalEstimatedMinutes = linkedTasks.reduce(
    (sum, t) => sum + t.estimatedMinutes,
    0
  );
  const remainingMinutes = linkedTasks
    .filter((t) => t.status !== 'DONE')
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    anchorId: anchor.id,
    readinessPercent,
    taskCompletionRatio,
    completedTasksCount,
    totalTasksCount,
    srMasteryAverage,
    linkedCardsCount,
    totalEstimatedMinutes,
    remainingMinutes,
  };
}
