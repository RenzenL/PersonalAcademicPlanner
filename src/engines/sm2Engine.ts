import { AnchorEvent, SpacedRepetitionCard, SRRating } from '../types/academic';
import { addDays, diffDays, toDateKey } from '../utils/dateUtils';

export interface SM2ReviewResult {
  updatedCard: SpacedRepetitionCard;
  rawIntervalDays: number;
  effectiveIntervalDays: number;
  wasExamClamped: boolean;
  clampedByAnchor?: AnchorEvent;
}

const MIN_EASE_FACTOR = 1.3;

/**
 * Computes the next SM-2 state for a flashcard given a user rating,
 * applying the Exam Clamp Rule when linked to an upcoming MINOR or MAJOR exam.
 *
 * Exam Clamp Rule:
 * If a card is linked to an upcoming AnchorEvent (`MINOR` or `MAJOR`),
 * cap `nextReviewDate` so that it never schedules a review *after* the exam date,
 * ensuring at least one final review occurs within 3 days prior to the exam.
 */
export function calculateSM2Review(
  card: SpacedRepetitionCard,
  rating: SRRating,
  reviewDateStr: string,
  anchorEvents: AnchorEvent[]
): SM2ReviewResult {
  const cleanReviewDate = toDateKey(reviewDateStr);
  let repetitions = card.repetitions;
  let easeFactor = card.easeFactor;
  let rawIntervalDays = card.intervalDays;

  switch (rating) {
    case 'AGAIN': {
      repetitions = 0;
      rawIntervalDays = 1;
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.2).toFixed(2)));
      break;
    }
    case 'HARD': {
      repetitions += 1;
      if (repetitions === 1) {
        rawIntervalDays = 1;
      } else if (repetitions === 2) {
        rawIntervalDays = 3;
      } else {
        rawIntervalDays = Math.max(1, Math.round(card.intervalDays * 1.2));
      }
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor - 0.15).toFixed(2)));
      break;
    }
    case 'GOOD': {
      repetitions += 1;
      if (repetitions === 1) {
        rawIntervalDays = 1;
      } else if (repetitions === 2) {
        rawIntervalDays = 6;
      } else {
        rawIntervalDays = Math.max(1, Math.round(card.intervalDays * easeFactor));
      }
      // Standard SM-2 quality=4 keeps easeFactor unchanged
      easeFactor = Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
      break;
    }
    case 'EASY': {
      repetitions += 1;
      if (repetitions === 1) {
        rawIntervalDays = 4;
      } else if (repetitions === 2) {
        rawIntervalDays = 8;
      } else {
        rawIntervalDays = Math.max(1, Math.round(card.intervalDays * easeFactor * 1.3));
      }
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((easeFactor + 0.15).toFixed(2)));
      break;
    }
  }

  let effectiveIntervalDays = rawIntervalDays;
  let nextReviewDate = addDays(cleanReviewDate, rawIntervalDays);
  let wasExamClamped = false;
  let clampedByAnchor: AnchorEvent | undefined;

  // Check Exam Clamp Rule for linked MINOR or MAJOR anchor event
  if (card.anchorId) {
    const linkedAnchor = anchorEvents.find(
      (a) =>
        a.id === card.anchorId &&
        !a.completed &&
        (a.type === 'MINOR' || a.type === 'MAJOR')
    );

    if (linkedAnchor) {
      const examDateKey = toDateKey(linkedAnchor.dueDate);
      const daysUntilExam = diffDays(cleanReviewDate, examDateKey);

      // Only clamp if the exam is still in the future relative to the review date
      if (daysUntilExam > 0) {
        // Window of [examDate - 3, examDate - 1] ensures a review within 3 days prior to exam
        // and never after the exam date.
        const finalWindowStart = addDays(examDateKey, -3);
        const finalWindowEnd = addDays(examDateKey, -1);

        // If raw nextReviewDate falls on or after examDate, OR if we are before the 3-day pre-exam
        // window and raw nextReviewDate jumps past the 3-day window
        if (diffDays(examDateKey, nextReviewDate) >= 0) {
          wasExamClamped = true;
          clampedByAnchor = linkedAnchor;

          if (diffDays(cleanReviewDate, finalWindowStart) > 0) {
            // Currently more than 3 days before exam: schedule inside the 3-day pre-exam window (2 days before exam)
            const targetPreExamDate = addDays(examDateKey, -2);
            nextReviewDate =
              diffDays(cleanReviewDate, targetPreExamDate) >= 1
                ? targetPreExamDate
                : finalWindowEnd;
          } else {
            // Already inside the 3-day pre-exam window: cap to 1 day before exam (or exam day if 0)
            nextReviewDate =
              diffDays(cleanReviewDate, finalWindowEnd) >= 1
                ? finalWindowEnd
                : examDateKey;
          }

          effectiveIntervalDays = Math.max(1, diffDays(cleanReviewDate, nextReviewDate));
        }
      }
    }
  }

  const updatedCard: SpacedRepetitionCard = {
    ...card,
    easeFactor,
    intervalDays: effectiveIntervalDays,
    repetitions,
    nextReviewDate,
    lastReviewedDate: cleanReviewDate,
    lastExamClamped: wasExamClamped,
  };

  return {
    updatedCard,
    rawIntervalDays,
    effectiveIntervalDays,
    wasExamClamped,
    clampedByAnchor,
  };
}

/**
 * Returns a preview of all 4 rating outcomes so the Flashcard Reviewer buttons
 * can show exact interval labels and clamp indicators.
 */
export function previewSM2Ratings(
  card: SpacedRepetitionCard,
  reviewDateStr: string,
  anchorEvents: AnchorEvent[]
): Record<SRRating, SM2ReviewResult> {
  return {
    AGAIN: calculateSM2Review(card, 'AGAIN', reviewDateStr, anchorEvents),
    HARD: calculateSM2Review(card, 'HARD', reviewDateStr, anchorEvents),
    GOOD: calculateSM2Review(card, 'GOOD', reviewDateStr, anchorEvents),
    EASY: calculateSM2Review(card, 'EASY', reviewDateStr, anchorEvents),
  };
}

/**
 * Computes an individual card's mastery score in [0, 1] for Exam Readiness tracking.
 */
export function computeCardMastery(card: SpacedRepetitionCard): number {
  if (card.repetitions <= 0) return 0;
  // Blend repetition count (up to 4 reps = 70% weight) + interval maturity (up to 10d = 30% weight)
  const repScore = Math.min(1, card.repetitions / 4);
  const intervalScore = Math.min(1, card.intervalDays / 10);
  const easeBonus = card.easeFactor >= 2.5 ? 0.05 : 0;
  return Math.min(1, Number((repScore * 0.7 + intervalScore * 0.3 + easeBonus).toFixed(4)));
}
