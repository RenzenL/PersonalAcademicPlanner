# KRONOS // Modular Academic Planner & Spaced Repetition Engine

A full-stack, local-first academic planner, modular study block manager, and SM-2 spaced repetition web application built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, **Zustand (`localStorage` persistence)**, **Lucide Icons**, and **`@dnd-kit/core` + `@dnd-kit/sortable`**.

---

## Core Architecture & Engines

### 1. Core Data Models ([`src/types/academic.ts`](src/types/academic.ts))
- **`Course`**: `id`, `code` (`CS701`, `CS742`, `AI802`, `CS764`), `name`, `colorHex`, `credits`.
- **`AnchorEvent` (Fixed Deadlines)**: `id`, `courseId`, `type` (`QUIZ` | `MINOR` | `MAJOR` | `ASSIGNMENT`), `title`, `dueDate` (ISO/YYYY-MM-DD), `weightage` (%), `completed`.
- **`TaskBlock` (Modular Study Units)**: `id`, `courseId`, `anchorId`, `title`, `estimatedMinutes`, `scheduledDate` (`YYYY-MM-DD` or `null` when staged in Backlog), `timeSlot` (`MORNING` | `AFTERNOON` | `EVENING`), `order`, `dependencyId`, `isBuffer`, `resourceLink`, `status` (`TODO` | `IN_PROGRESS` | `DONE` | `MISSED`).
- **`SpacedRepetitionCard`**: `id`, `courseId`, `anchorId`, `topicTitle`, `promptQuestion`, `answerNotes`, `resourceLink`, `easeFactor` (default `2.5`), `intervalDays` (default `0`), `repetitions` (default `0`), `nextReviewDate` (`YYYY-MM-DD`), `lastReviewedDate`.

### 2. Modular Bulk-Shifting & Ripple Engine ([`src/engines/rippleEngine.ts`](src/engines/rippleEngine.ts))
- **Day/Range Ripple Shift**: Every day column header includes a **`Shift +1d`** button (`shiftDayColumnTasks`), alongside a global **`Ripple Missed Tasks`** button (`rippleAllMissedTasks`) in the Top Bar.
- **Buffer Absorption Mode (`BUFFER_FIRST`)**: Automatically absorbs missed or shifted tasks into the earliest available `isBuffer: true` slot before pushing future scheduled tasks.
- **Cascade Mode (`CASCADE`)**: Shifts selected or missed tasks forward by `N` days and automatically cascades downstream dependent tasks (`dependencyId`) in topological order while keeping `AnchorEvents` fixed.
- **Collision & Capacity Guardrails**: Configurable daily capacity (`360 mins` / 6 hours default). Displays visual red borders and alert badges whenever shifting causes a day to exceed capacity, pushes a task past its linked `AnchorEvent.dueDate`, or violates parent `dependencyId` order.

### 3. SM-2 Spaced Repetition Engine with Exam Clamping ([`src/engines/sm2Engine.ts`](src/engines/sm2Engine.ts))
- **4 Rating Buttons**: `Again` (reset), `Hard`, `Good`, `Easy` with live interval previews on each button.
- **Exam Clamp Rule**: When a card is linked to an upcoming `MINOR` or `MAJOR` `AnchorEvent`, `nextReviewDate` is capped so it never schedules a review after the exam date and guarantees at least one final review within the 3-day window prior to the exam.

### 4. Exam Readiness & Weightage Tracker ([`src/engines/readinessEngine.ts`](src/engines/readinessEngine.ts))
- Live Readiness % calculated for every AnchorEvent:
  $$\text{Readiness} = \left(\frac{\text{Completed Linked TaskBlocks}}{\text{Total Linked TaskBlocks}}\right) \times 0.6 + (\text{Average SR Mastery of Linked Cards}) \times 0.4$$

---

## Keyboard Shortcuts
- `Cmd/Ctrl + K`: Open Command Palette
- `N`: Quick-Add Modular Study Task Block
- `E`: Quick-Add Fixed Academic Exam / Assignment (`AnchorEvent`)
- `F`: Quick-Add Spaced Repetition Flashcard

## Running Locally
```bash
npm install
npm run dev
```

## Cross-device Cloud Sync (Supabase)

The planner saves locally by default. To sync data between devices, configure
Supabase:

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql)
   in its SQL Editor. The table uses row-level security so each account can
   access only its own planner data.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings.
3. Run `npm install`, then restart the Vite server. In the app, choose **Cloud
   Sync → Create account** on the first device, then sign in with that account
   on other devices.
4. For a deployed build, configure the same two `VITE_` variables in the
   hosting provider's build environment and rebuild/redeploy. These values are
   included in the browser app; use only the public anon/publishable key, never
   a `service_role` key. Row-level security protects the stored planner data.

On the first sign-in, existing local planner data is uploaded if the cloud
account has no data. If both copies already contain different data, the app
asks which copy to keep. Cloud changes are applied in real time; avoid editing
the same account simultaneously on multiple devices, since the planner is
stored as one document rather than merged record-by-record.
