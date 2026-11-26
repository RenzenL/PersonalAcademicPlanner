import {
  AnchorEvent,
  ClassSchedule,
  Course,
  Note,
  SpacedRepetitionCard,
  StudyLog,
  TaskBlock,
} from '../types/academic';
import { addDays, getTodayDateKey } from '../utils/dateUtils';

export function createEmptyAcademicData(): {
  courses: Course[];
  anchorEvents: AnchorEvent[];
  taskBlocks: TaskBlock[];
  srCards: SpacedRepetitionCard[];
  classSchedules: ClassSchedule[];
  studyLogs: StudyLog[];
  notes: Note[];
} {
  return {
    courses: [],
    anchorEvents: [],
    taskBlocks: [],
    srCards: [],
    classSchedules: [],
    studyLogs: [],
    notes: [],
  };
}

/**
 * Rich Notion-style sample graduate CS/AI template that users can load with 1 click
 * whenever they want to explore a populated workspace or test calendar/ripple features.
 */
export function createNotionSampleTemplate(referenceToday = getTodayDateKey()): {
  courses: Course[];
  anchorEvents: AnchorEvent[];
  taskBlocks: TaskBlock[];
  srCards: SpacedRepetitionCard[];
  classSchedules: ClassSchedule[];
  studyLogs: StudyLog[];
  notes: Note[];
} {
  const d = (offset: number) => addDays(referenceToday, offset);

  const courses: Course[] = [
    {
      id: 'course-cs701',
      code: 'CS701',
      name: 'Deep Generative Models',
      colorHex: '#9065B0', // Notion Purple
      credits: 4,
      icon: '🧠',
      createdAt: d(-14),
      syllabus: [
        { id: 'syl-1', title: 'Variational Autoencoders & ELBO', completed: true, weekLabel: 'Wk 1-2' },
        { id: 'syl-2', title: 'Score Matching & Langevin Dynamics', completed: true, weekLabel: 'Wk 3-4' },
        { id: 'syl-3', title: 'DDPM & Forward-Reverse SDEs', completed: false, weekLabel: 'Wk 5-6' },
        { id: 'syl-4', title: 'Flow Matching & Consistency Models', completed: false, weekLabel: 'Wk 7-8' },
      ],
    },
    {
      id: 'course-cs742',
      code: 'CS742',
      name: 'Distributed Systems & Consensus',
      colorHex: '#448361', // Notion Green
      credits: 4,
      icon: '🌐',
      createdAt: d(-14),
      syllabus: [
        { id: 'syl-5', title: 'Logical Clocks & Linearizability', completed: true, weekLabel: 'Wk 1-2' },
        { id: 'syl-6', title: 'Raft Leader Election & Log Replication', completed: false, weekLabel: 'Wk 3-4' },
        { id: 'syl-7', title: 'PBFT & Byzantine Quorums', completed: false, weekLabel: 'Wk 5-6' },
      ],
    },
    {
      id: 'course-ai802',
      code: 'AI802',
      name: 'Reinforcement Learning',
      colorHex: '#D9730D', // Notion Orange
      credits: 3,
      icon: '🤖',
      createdAt: d(-14),
      syllabus: [
        { id: 'syl-8', title: 'MDPs, Bellman Optimality & Q-Learning', completed: true, weekLabel: 'Wk 1-2' },
        { id: 'syl-9', title: 'REINFORCE, GAE & PPO Clipping', completed: false, weekLabel: 'Wk 3-4' },
      ],
    },
    {
      id: 'course-cs764',
      code: 'CS764',
      name: 'ML Compilers & GPU Kernels',
      colorHex: '#337EA9', // Notion Blue
      credits: 4,
      icon: '⚡',
      createdAt: d(-14),
      syllabus: [
        { id: 'syl-10', title: 'Polyhedral Loop Scheduling', completed: false, weekLabel: 'Wk 1-2' },
        { id: 'syl-11', title: 'Triton Tiling & FlashAttention', completed: false, weekLabel: 'Wk 3-4' },
      ],
    },
  ];

  const anchorEvents: AnchorEvent[] = [
    {
      id: 'anchor-ai802-quiz',
      courseId: 'course-ai802',
      type: 'QUIZ',
      title: 'Quiz 2: Policy Gradients & PPO Clipping',
      dueDate: d(2),
      weightage: 15,
      completed: false,
    },
    {
      id: 'anchor-cs701-minor',
      courseId: 'course-cs701',
      type: 'MINOR',
      title: 'Minor Exam: Score Matching & Diffusion',
      dueDate: d(4),
      weightage: 25,
      completed: false,
    },
    {
      id: 'anchor-cs742-assign',
      courseId: 'course-cs742',
      type: 'ASSIGNMENT',
      title: 'Lab 3: Raft Log Compaction & Snapshots',
      dueDate: d(6),
      weightage: 20,
      completed: false,
    },
    {
      id: 'anchor-cs764-major',
      courseId: 'course-cs764',
      type: 'MAJOR',
      title: 'Major Exam: Polyhedral Loop Scheduling & Triton',
      dueDate: d(11),
      weightage: 40,
      completed: false,
    },
  ];

  const taskBlocks: TaskBlock[] = [
    {
      id: 'task-missed-1',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      title: 'Derive ELBO & Forward-Reverse SDE Equivalence',
      estimatedMinutes: 90,
      scheduledDate: d(-1),
      timeSlot: 'EVENING',
      order: 0,
      isBuffer: false,
      resourceLink: 'https://arxiv.org/abs/2011.13456',
      status: 'MISSED',
    },
    {
      id: 'task-today-1',
      courseId: 'course-ai802',
      anchorId: 'anchor-ai802-quiz',
      title: 'Work through PPO Clipped Surrogate Past Quiz Problems',
      estimatedMinutes: 90,
      scheduledDate: d(0),
      timeSlot: 'MORNING',
      order: 0,
      isBuffer: false,
      resourceLink: 'https://arxiv.org/abs/1707.06347',
      status: 'IN_PROGRESS',
    },
    {
      id: 'task-today-2',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      title: 'Denoising Score Matching & Langevin Dynamics Proofs',
      estimatedMinutes: 120,
      scheduledDate: d(0),
      timeSlot: 'AFTERNOON',
      order: 0,
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-today-3',
      courseId: 'course-cs742',
      anchorId: 'anchor-cs742-assign',
      title: 'Implement InstallSnapshot RPC & Log Truncation',
      estimatedMinutes: 90,
      scheduledDate: d(0),
      timeSlot: 'EVENING',
      order: 0,
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-d1-1',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      title: 'Classifier-Free Guidance & DDIM Deterministic Sampling',
      estimatedMinutes: 90,
      scheduledDate: d(1),
      timeSlot: 'MORNING',
      order: 0,
      dependencyId: 'task-today-2',
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-d1-buffer',
      courseId: 'course-cs701',
      title: 'Catch-up & Overflow Buffer Block',
      estimatedMinutes: 90,
      scheduledDate: d(1),
      timeSlot: 'AFTERNOON',
      order: 0,
      isBuffer: true,
      status: 'TODO',
    },
    {
      id: 'task-d2-1',
      courseId: 'course-cs742',
      anchorId: 'anchor-cs742-assign',
      title: 'Run Jepsen Network Partition & Split-Brain Tests',
      estimatedMinutes: 120,
      scheduledDate: d(2),
      timeSlot: 'AFTERNOON',
      order: 0,
      dependencyId: 'task-today-3',
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-d3-1',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      title: 'Solve Past CS701 Minor Exam Papers Timed',
      estimatedMinutes: 120,
      scheduledDate: d(3),
      timeSlot: 'MORNING',
      order: 0,
      dependencyId: 'task-d1-1',
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-backlog-1',
      courseId: 'course-cs764',
      anchorId: 'anchor-cs764-major',
      title: 'Profile Roofline Model Arithmetic Intensity on A100',
      estimatedMinutes: 75,
      scheduledDate: null,
      timeSlot: 'MORNING',
      order: 0,
      isBuffer: false,
      status: 'TODO',
    },
    {
      id: 'task-backlog-2',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      title: 'Read Consistency Models Single-Step Distillation Paper',
      estimatedMinutes: 60,
      scheduledDate: null,
      timeSlot: 'AFTERNOON',
      order: 1,
      isBuffer: false,
      status: 'TODO',
    },
  ];

  const srCards: SpacedRepetitionCard[] = [
    {
      id: 'sr-card-1',
      courseId: 'course-cs701',
      anchorId: 'anchor-cs701-minor',
      topicTitle: 'Denoising Score Matching',
      promptQuestion:
        'Why does Denoising Score Matching avoid computing the trace of the Jacobian of the score network?',
      answerNotes:
        'By perturbing x with Gaussian noise q(x_tilde | x), the conditional score grad log q(x_tilde | x) = -(x_tilde - x)/sigma^2 is analytically known and matches the true score in expectation.',
      easeFactor: 2.5,
      intervalDays: 3,
      repetitions: 2,
      nextReviewDate: d(0),
      lastReviewedDate: d(-3),
    },
    {
      id: 'sr-card-2',
      courseId: 'course-ai802',
      anchorId: 'anchor-ai802-quiz',
      topicTitle: 'PPO Clipped Surrogate Objective',
      promptQuestion:
        'What does the min() operator in PPO-Clip do when advantage A_t < 0 and probability ratio r_t > 1 + epsilon?',
      answerNotes:
        'When A_t < 0 and r_t > 1 + epsilon, the unclipped term r_t * A_t is more negative than (1 + epsilon)*A_t, so min() selects the unclipped term so gradient updates reverse the bad policy step.',
      easeFactor: 2.5,
      intervalDays: 2,
      repetitions: 2,
      nextReviewDate: d(0),
      lastReviewedDate: d(-2),
    },
    {
      id: 'sr-card-3',
      courseId: 'course-cs742',
      anchorId: 'anchor-cs742-assign',
      topicTitle: 'Raft Term Commitment Rule',
      promptQuestion:
        'Why can a Raft leader never commit log entries from an older term solely by counting replicas?',
      answerNotes:
        'Figure 8 of the Raft paper: an older-term entry replicated on a majority can still be overwritten if a candidate with a higher last-log term wins election. Leaders only commit current-term entries by majority count.',
      easeFactor: 2.5,
      intervalDays: 4,
      repetitions: 2,
      nextReviewDate: d(0),
      lastReviewedDate: d(-4),
    },
  ];

  const classSchedules: ClassSchedule[] = [
    {
      id: 'cls-cs701-lec',
      courseId: 'course-cs701',
      title: 'CS701 Lecture',
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      startTime: '10:00',
      endTime: '11:00',
      location: 'LH-301',
    },
    {
      id: 'cls-cs742-lec',
      courseId: 'course-cs742',
      title: 'CS742 Lecture & Lab',
      daysOfWeek: [2, 4], // Tue, Thu
      startTime: '14:00',
      endTime: '15:30',
      location: 'Gates 402',
    },
    {
      id: 'cls-ai802-lec',
      courseId: 'course-ai802',
      title: 'AI802 Seminar',
      daysOfWeek: [1, 4], // Mon, Thu
      startTime: '16:00',
      endTime: '17:30',
      location: 'Room 210',
    },
  ];

  const studyLogs: StudyLog[] = [
    {
      id: 'log-1',
      courseId: 'course-cs701',
      date: d(-1),
      minutes: 60,
      notes: 'Reviewed ELBO derivation & score matching notes',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-2',
      courseId: 'course-cs764',
      date: d(-10), // 10 days ago -> triggers >7d neglected subject warning!
      minutes: 45,
      notes: 'Read Triton tiling intro',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-3',
      customTopic: 'Competitive Programming — Segment Trees',
      date: d(0),
      minutes: 45,
      notes: 'Outside-curriculum practice on lazy propagation',
      createdAt: new Date().toISOString(),
    },
  ];

  const notes: Note[] = [
    {
      id: 'note-score-matching',
      title: 'Score Matching & Langevin Dynamics',
      courseId: 'course-cs701',
      tags: ['diffusion', 'sde', 'generative'],
      backlinks: ['note-elbo-vae'],
      linkedAnchorIds: ['anchor-cs701-minor'],
      content: `# Score Matching & Langevin Dynamics

In score-based generative models, we estimate the **Stein score function** $\\nabla_x \\log p_{data}(x)$ without computing the intractable partition function $Z_\\theta$.

## Key Objective
$$\\mathcal{L}_{DSM}(\\theta) = \\mathbb{E}_{q(x, \\tilde{x})}\\left[ \\frac{1}{2} \\left\\| s_\\theta(\\tilde{x}) - \\nabla_{\\tilde{x}} \\log q(\\tilde{x} \\mid x) \\right\\|^2 \\right]$$

### Study Checklist
- [x] Derive Hyvärinen's integration-by-parts trick
- [x] Connect to [[Variational Autoencoders & ELBO]]
- [ ] Practice problems for [[Minor Exam: Score Matching & Diffusion]]
`,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'note-elbo-vae',
      title: 'Variational Autoencoders & ELBO',
      courseId: 'course-cs701',
      tags: ['vae', 'latent'],
      backlinks: ['note-score-matching'],
      linkedAnchorIds: ['anchor-cs701-minor'],
      content: `# Variational Autoencoders & ELBO

The Evidence Lower Bound decomposes log-likelihood into reconstruction and KL regularization:

$$\\log p_\\theta(x) \\ge \\mathbb{E}_{q_\\phi(z|x)}[\\log p_\\theta(x|z)] - D_{KL}(q_\\phi(z|x) \\,\\|\\, p(z))$$

Related reading: [[Score Matching & Langevin Dynamics]] and [[Minor Exam: Score Matching & Diffusion]].
`,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'note-raft-consensus',
      title: 'Raft Leader Election & Safety',
      courseId: 'course-cs742',
      tags: ['consensus', 'distributed'],
      backlinks: [],
      content: `# Raft Leader Election & Safety

A candidate must receive votes from a majority quorum $\\lfloor N/2 \\rfloor + 1$ and possess a log at least as up-to-date as any member of that quorum.

- [x] Review Election Safety invariant
- [ ] Trace split-vote randomized timeout ($150\\text{--}300\\text{ms}$)
`,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'note-ppo-clipping',
      title: 'Policy Gradients & PPO Clipping',
      courseId: 'course-ai802',
      tags: ['rl', 'policy-gradient'],
      backlinks: [],
      linkedAnchorIds: ['anchor-ai802-quiz'],
      content: `# Policy Gradients & PPO Clipping

PPO-Clip constrains the probability ratio $r_t(\\theta) = \\frac{\\pi_\\theta(a_t|s_t)}{\\pi_{\\theta_{old}}(a_t|s_t)}$ within $[1-\\epsilon, 1+\\epsilon]$:

$$L^{CLIP}(\\theta) = \\hat{\\mathbb{E}}_t \\left[ \\min(r_t(\\theta)\\hat{A}_t, \\text{clip}(r_t(\\theta), 1-\\epsilon, 1+\\epsilon)\\hat{A}_t) \\right]$$

Linked assessment: [[Quiz 2: Policy Gradients & PPO Clipping]]
`,
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    courses,
    anchorEvents,
    taskBlocks,
    srCards,
    classSchedules,
    studyLogs,
    notes,
  };
}
