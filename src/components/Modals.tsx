import React, { useEffect, useState } from 'react';
import {
  AnchorEvent,
  AnchorEventType,
  ClassSchedule,
  Course,
  SpacedRepetitionCard,
  TaskBlock,
  TaskStatus,
  TimeSlot,
} from '../types/academic';
import { useAcademicStore } from '../store/useAcademicStore';
import { getTodayDateKey } from '../utils/dateUtils';
import { BookOpen, CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Checkbox, Dot, ModalShell } from './ui';

/* ============================================================================
 * 1. TASK BLOCK MODAL
 * ========================================================================== */
interface TaskModalProps {
  isOpen: boolean;
  editingTask: TaskBlock | null;
  defaultDate?: string | null;
  defaultSlot?: TimeSlot;
  onClose: () => void;
}

export const TaskBlockModal: React.FC<TaskModalProps> = ({
  isOpen,
  editingTask,
  defaultDate,
  defaultSlot = 'MORNING',
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const taskBlocks = useAcademicStore((s) => s.taskBlocks);
  const addTaskBlock = useAcademicStore((s) => s.addTaskBlock);
  const updateTaskBlock = useAcademicStore((s) => s.updateTaskBlock);
  const deleteTaskBlock = useAcademicStore((s) => s.deleteTaskBlock);

  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [anchorId, setAnchorId] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [isBacklog, setIsBacklog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(getTodayDateKey());
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('MORNING');
  const [dependencyId, setDependencyId] = useState('');
  const [isBuffer, setIsBuffer] = useState(false);
  const [resourceLink, setResourceLink] = useState('');
  const [status, setStatus] = useState<TaskStatus>('TODO');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setCourseId(editingTask.courseId || '');
      setAnchorId(editingTask.anchorId || '');
      setEstimatedMinutes(editingTask.estimatedMinutes);
      setIsBacklog(editingTask.scheduledDate === null);
      setScheduledDate(editingTask.scheduledDate || getTodayDateKey());
      setTimeSlot(editingTask.timeSlot);
      setDependencyId(editingTask.dependencyId || '');
      setIsBuffer(editingTask.isBuffer);
      setResourceLink(editingTask.resourceLink || '');
      setStatus(editingTask.status);
    } else {
      setTitle('');
      setCourseId(courses[0]?.id || '');
      setAnchorId('');
      setEstimatedMinutes(60);
      setIsBacklog(defaultDate === null);
      setScheduledDate(defaultDate || getTodayDateKey());
      setTimeSlot(defaultSlot);
      setDependencyId('');
      setIsBuffer(false);
      setResourceLink('');
      setStatus('TODO');
    }
  }, [editingTask, isOpen, defaultDate, defaultSlot, courses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      courseId: courseId || '',
      anchorId: anchorId || undefined,
      estimatedMinutes: Number(estimatedMinutes) || 60,
      scheduledDate: isBacklog ? null : scheduledDate,
      timeSlot,
      dependencyId: dependencyId || undefined,
      isBuffer,
      resourceLink: resourceLink.trim() || undefined,
      status,
    };

    if (editingTask) {
      updateTaskBlock(editingTask.id, payload);
    } else {
      addTaskBlock(payload);
    }
    onClose();
  };

  const candidateParents = taskBlocks.filter(
    (t) => !t.isBuffer && t.id !== editingTask?.id
  );

  return (
    <ModalShell
      title={editingTask ? 'Edit Study Block' : 'New Study Block'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
        <div>
          <label className="label">Block Title</label>
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Derive Score Matching Objective..."
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input"
            >
              <option value="">No Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Linked Deadline</label>
            <select
              value={anchorId}
              onChange={(e) => setAnchorId(e.target.value)}
              className="input"
            >
              <option value="">None</option>
              {anchorEvents.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.type}] {a.title} ({a.dueDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Duration (min)</label>
            <input
              type="number"
              min={10}
              max={480}
              step={5}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="label">Time Slot</label>
            <select
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
              className="input"
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>

          <div>
            <label className="label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="input"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
              <option value="MISSED">Missed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="label">Scheduled Date</label>
            <input
              type="date"
              disabled={isBacklog}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="input font-mono disabled:opacity-40"
            />
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elev border border-line cursor-pointer">
            <input
              type="checkbox"
              checked={isBacklog}
              onChange={(e) => setIsBacklog(e.target.checked)}
            />
            <span className="text-fg">Stage in Backlog</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prerequisite Task</label>
            <select
              value={dependencyId}
              onChange={(e) => setDependencyId(e.target.value)}
              className="input"
            >
              <option value="">None</option>
              {candidateParents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Resource URL</label>
            <input
              type="url"
              value={resourceLink}
              onChange={(e) => setResourceLink(e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elev border border-line cursor-pointer">
          <input
            type="checkbox"
            checked={isBuffer}
            onChange={(e) => setIsBuffer(e.target.checked)}
          />
          <span className="text-fg">
            Elastic Buffer Block (absorbs missed or shifted tasks)
          </span>
        </label>

        <div className="pt-3 border-t border-line flex items-center justify-between">
          {editingTask ? (
            <button
              type="button"
              onClick={() => {
                deleteTaskBlock(editingTask.id);
                onClose();
              }}
              className="btn-danger"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-soft">
              Cancel
            </button>
            <button type="submit" className="btn-solid">
              {editingTask ? 'Save Changes' : 'Create Study Block'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 2. ANCHOR EVENT MODAL
 * ========================================================================== */
interface AnchorModalProps {
  isOpen: boolean;
  editingAnchor: AnchorEvent | null;
  onClose: () => void;
}

export const AnchorEventModal: React.FC<AnchorModalProps> = ({
  isOpen,
  editingAnchor,
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const addAnchorEvent = useAcademicStore((s) => s.addAnchorEvent);
  const updateAnchorEvent = useAcademicStore((s) => s.updateAnchorEvent);
  const deleteAnchorEvent = useAcademicStore((s) => s.deleteAnchorEvent);

  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [type, setType] = useState<AnchorEventType>('MINOR');
  const [dueDate, setDueDate] = useState(getTodayDateKey());
  const [weightage, setWeightage] = useState(25);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (editingAnchor) {
      setTitle(editingAnchor.title);
      setCourseId(editingAnchor.courseId || '');
      setType(editingAnchor.type);
      setDueDate(editingAnchor.dueDate.slice(0, 10));
      setWeightage(editingAnchor.weightage);
      setCompleted(editingAnchor.completed);
    } else {
      setTitle('');
      setCourseId(courses[0]?.id || '');
      setType('MINOR');
      setDueDate(getTodayDateKey());
      setWeightage(25);
      setCompleted(false);
    }
  }, [editingAnchor, isOpen, courses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      courseId: courseId || '',
      type,
      dueDate,
      weightage: Number(weightage) || 10,
      completed,
    };

    if (editingAnchor) {
      updateAnchorEvent(editingAnchor.id, payload);
    } else {
      addAnchorEvent(payload);
    }
    onClose();
  };

  return (
    <ModalShell
      title={editingAnchor ? 'Edit Fixed Deadline' : 'New Fixed Deadline'}
      width="max-w-md"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
        <div>
          <label className="label">Title</label>
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Minor Exam: Score Matching & Diffusion"
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input"
            >
              <option value="">No Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AnchorEventType)}
              className="input"
            >
              <option value="QUIZ">Quiz</option>
              <option value="MINOR">Minor Exam</option>
              <option value="MAJOR">Major Exam</option>
              <option value="ASSIGNMENT">Assignment</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input font-mono"
            />
          </div>

          <div>
            <label className="label">Weightage (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={weightage}
              onChange={(e) => setWeightage(Number(e.target.value))}
              className="input font-mono"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elev border border-line cursor-pointer">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />
          <span className="text-fg">Mark as Completed</span>
        </label>

        <div className="pt-3 border-t border-line flex items-center justify-between">
          {editingAnchor ? (
            <button
              type="button"
              onClick={() => {
                deleteAnchorEvent(editingAnchor.id);
                onClose();
              }}
              className="btn-danger"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-soft">
              Cancel
            </button>
            <button type="submit" className="btn-solid">
              {editingAnchor ? 'Save Changes' : 'Pin Deadline'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 3. SPACED REPETITION CARD MODAL
 * ========================================================================== */
interface SRCardModalProps {
  isOpen: boolean;
  editingCard: SpacedRepetitionCard | null;
  onClose: () => void;
}

export const SRCardModal: React.FC<SRCardModalProps> = ({
  isOpen,
  editingCard,
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const anchorEvents = useAcademicStore((s) => s.anchorEvents);
  const addSRCard = useAcademicStore((s) => s.addSRCard);
  const updateSRCard = useAcademicStore((s) => s.updateSRCard);
  const deleteSRCard = useAcademicStore((s) => s.deleteSRCard);

  const [topicTitle, setTopicTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [anchorId, setAnchorId] = useState('');
  const [promptQuestion, setPromptQuestion] = useState('');
  const [answerNotes, setAnswerNotes] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState(getTodayDateKey());

  useEffect(() => {
    if (editingCard) {
      setTopicTitle(editingCard.topicTitle);
      setCourseId(editingCard.courseId || '');
      setAnchorId(editingCard.anchorId || '');
      setPromptQuestion(editingCard.promptQuestion);
      setAnswerNotes(editingCard.answerNotes);
      setResourceLink(editingCard.resourceLink || '');
      setNextReviewDate(editingCard.nextReviewDate);
    } else {
      setTopicTitle('');
      setCourseId(courses[0]?.id || '');
      setAnchorId('');
      setPromptQuestion('');
      setAnswerNotes('');
      setResourceLink('');
      setNextReviewDate(getTodayDateKey());
    }
  }, [editingCard, isOpen, courses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim() || !promptQuestion.trim()) return;

    if (editingCard) {
      updateSRCard(editingCard.id, {
        topicTitle: topicTitle.trim(),
        courseId: courseId || '',
        anchorId: anchorId || undefined,
        promptQuestion: promptQuestion.trim(),
        answerNotes: answerNotes.trim(),
        resourceLink: resourceLink.trim() || undefined,
        nextReviewDate,
      });
    } else {
      addSRCard({
        topicTitle: topicTitle.trim(),
        courseId: courseId || '',
        anchorId: anchorId || undefined,
        promptQuestion: promptQuestion.trim(),
        answerNotes: answerNotes.trim(),
        resourceLink: resourceLink.trim() || undefined,
        nextReviewDate,
      });
    }
    onClose();
  };

  return (
    <ModalShell
      title={editingCard ? 'Edit Flashcard' : 'New Spaced Repetition Card'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input"
            >
              <option value="">No Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Linked Exam (Exam Clamp)</label>
            <select
              value={anchorId}
              onChange={(e) => setAnchorId(e.target.value)}
              className="input"
            >
              <option value="">None</option>
              {anchorEvents.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.type}] {a.title} ({a.dueDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="label">Topic Title</label>
            <input
              type="text"
              required
              autoFocus
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="Concept or theorem..."
              className="input"
            />
          </div>

          <div>
            <label className="label">Next Review</label>
            <input
              type="date"
              value={nextReviewDate}
              onChange={(e) => setNextReviewDate(e.target.value)}
              className="input font-mono"
            />
          </div>
        </div>

        <div>
          <label className="label">Prompt Question</label>
          <textarea
            rows={2}
            required
            value={promptQuestion}
            onChange={(e) => setPromptQuestion(e.target.value)}
            placeholder="Active recall question..."
            className="input"
          />
        </div>

        <div>
          <label className="label">Answer Notes</label>
          <textarea
            rows={3}
            required
            value={answerNotes}
            onChange={(e) => setAnswerNotes(e.target.value)}
            placeholder="Derivation steps, formulas, or key takeaways..."
            className="input"
          />
        </div>

        <div>
          <label className="label">Resource Link</label>
          <input
            type="url"
            value={resourceLink}
            onChange={(e) => setResourceLink(e.target.value)}
            placeholder="https://..."
            className="input"
          />
        </div>

        <div className="pt-3 border-t border-line flex items-center justify-between">
          {editingCard ? (
            <button
              type="button"
              onClick={() => {
                deleteSRCard(editingCard.id);
                onClose();
              }}
              className="btn-danger"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-soft">
              Cancel
            </button>
            <button type="submit" className="btn-solid">
              {editingCard ? 'Save Changes' : 'Create Flashcard'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};

/* ============================================================================
 * 4. COURSE & SYLLABUS MODAL
 * ========================================================================== */
interface CourseModalProps {
  isOpen: boolean;
  editingCourse: Course | null;
  onSelectEditCourse: (course: Course | null) => void;
  onClose: () => void;
}

const COURSE_COLORS = [
  '#9065B0',
  '#448361',
  '#D9730D',
  '#337EA9',
  '#C14C8A',
  '#DFAB01',
  '#EB5757',
  '#787774',
];

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  editingCourse,
  onSelectEditCourse,
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const addCourse = useAcademicStore((s) => s.addCourse);
  const updateCourse = useAcademicStore((s) => s.updateCourse);
  const deleteCourse = useAcademicStore((s) => s.deleteCourse);
  const addSyllabusTopic = useAcademicStore((s) => s.addSyllabusTopic);
  const toggleSyllabusTopic = useAcademicStore((s) => s.toggleSyllabusTopic);
  const deleteSyllabusTopic = useAcademicStore((s) => s.deleteSyllabusTopic);
  const importSyllabusLines = useAcademicStore((s) => s.importSyllabusLines);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState(4);
  const [colorHex, setColorHex] = useState(COURSE_COLORS[0]);

  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicWeek, setNewTopicWeek] = useState('');
  const [bulkSyllabusText, setBulkSyllabusText] = useState('');
  const [showBulkPaste, setShowBulkPaste] = useState(false);

  // Live reference to the edited course from store so syllabus updates reflect immediately
  const liveEditingCourse = editingCourse
    ? courses.find((c) => c.id === editingCourse.id) || editingCourse
    : null;

  useEffect(() => {
    if (editingCourse) {
      setCode(editingCourse.code);
      setName(editingCourse.name);
      setCredits(editingCourse.credits);
      setColorHex(editingCourse.colorHex);
    } else {
      setCode('');
      setName('');
      setCredits(4);
      setColorHex(COURSE_COLORS[courses.length % COURSE_COLORS.length]);
    }
    setNewTopicTitle('');
    setNewTopicWeek('');
    setBulkSyllabusText('');
    setShowBulkPaste(false);
  }, [editingCourse, isOpen, courses.length]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    if (liveEditingCourse) {
      updateCourse(liveEditingCourse.id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        credits: Number(credits) || 3,
        colorHex,
      });
      onSelectEditCourse(null);
    } else {
      const created = addCourse({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        credits: Number(credits) || 3,
        colorHex,
      });
      onSelectEditCourse(created);
    }
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveEditingCourse || !newTopicTitle.trim()) return;
    addSyllabusTopic(liveEditingCourse.id, newTopicTitle.trim(), newTopicWeek);
    setNewTopicTitle('');
    setNewTopicWeek('');
  };

  const handleBulkImport = () => {
    if (!liveEditingCourse || !bulkSyllabusText.trim()) return;
    importSyllabusLines(liveEditingCourse.id, bulkSyllabusText);
    setBulkSyllabusText('');
    setShowBulkPaste(false);
  };

  return (
    <ModalShell
      title={
        liveEditingCourse
          ? `Course & Syllabus — ${liveEditingCourse.code}`
          : 'Courses & Syllabi'
      }
      subtitle="Register courses and enter their syllabus topics"
      width="max-w-xl"
      onClose={onClose}
    >
      <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
        {courses.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {courses.map((c) => {
              const syl = c.syllabus || [];
              const doneCount = syl.filter((s) => s.completed).length;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectEditCourse(c)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    liveEditingCourse?.id === c.id
                      ? 'bg-elev border-line-strong'
                      : 'bg-app border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Dot color={c.colorHex} />
                    <span className="font-mono font-semibold text-fg">{c.code}</span>
                    <span className="text-muted truncate">{c.name}</span>
                    <span className="font-mono text-[10px] text-subtle">
                      {syl.length > 0 ? `${doneCount}/${syl.length} topics` : 'no syllabus'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEditCourse(c);
                      }}
                      className="icon-btn"
                      title="Edit course & syllabus"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourse(c.id);
                        if (liveEditingCourse?.id === c.id) onSelectEditCourse(null);
                      }}
                      className="icon-btn hover:!text-danger"
                      title="Delete course"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 pt-3 border-t border-line"
        >
          <div className="flex items-center justify-between">
            <span className="section-label">
              {liveEditingCourse ? 'Course Details' : 'Add New Course'}
            </span>
            {liveEditingCourse && (
              <button
                type="button"
                onClick={() => onSelectEditCourse(null)}
                className="text-[11px] text-info hover:underline"
              >
                + Create Another Course
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS701"
              className="input font-mono uppercase"
            />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Course Name"
              className="input col-span-2"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {COURSE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColorHex(hex)}
                  className={`w-4 h-4 rounded-full border transition-transform ${
                    colorHex === hex
                      ? 'scale-125 border-fg'
                      : 'border-transparent opacity-65'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted">Credits</span>
              <input
                type="number"
                min={1}
                max={10}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="input !w-14 !py-1 font-mono"
              />
              <button type="submit" className="btn-solid">
                {liveEditingCourse ? 'Save Course' : 'Create & Add Syllabus'}
              </button>
            </div>
          </div>
        </form>

        {/* Syllabus Section for Selected Course */}
        {liveEditingCourse && (
          <div className="pt-3 border-t border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="section-label flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Syllabus Topics ({(liveEditingCourse.syllabus || []).length})
              </span>
              <button
                type="button"
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className="pill hover:text-fg"
              >
                {showBulkPaste ? 'Hide Bulk Paste' : 'Paste Syllabus List'}
              </button>
            </div>

            {showBulkPaste && (
              <div className="space-y-2 p-3 rounded-lg bg-app border border-line">
                <textarea
                  rows={4}
                  value={bulkSyllabusText}
                  onChange={(e) => setBulkSyllabusText(e.target.value)}
                  placeholder="Paste syllabus topics (one per line)..."
                  className="input"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    className="btn-solid"
                  >
                    Import Lines
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {(liveEditingCourse.syllabus || []).length === 0 ? (
                <p className="text-xs text-muted py-2">
                  No syllabus topics yet. Add topics below or paste your syllabus outline.
                </p>
              ) : (
                (liveEditingCourse.syllabus || []).map((topic) => (
                  <div
                    key={topic.id}
                    className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-app border border-line"
                  >
                    <Checkbox
                      size="sm"
                      checked={topic.completed}
                      onToggle={() =>
                        toggleSyllabusTopic(liveEditingCourse.id, topic.id)
                      }
                    />
                    <span
                      className={`flex-1 ${
                        topic.completed ? 'line-through text-subtle' : 'text-fg'
                      }`}
                    >
                      {topic.title}
                    </span>
                    {topic.weekLabel && (
                      <span className="pill">{topic.weekLabel}</span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        deleteSyllabusTopic(liveEditingCourse.id, topic.id)
                      }
                      className="icon-btn opacity-0 group-hover:opacity-100 hover:!text-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddTopic} className="flex items-center gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Add syllabus topic (e.g., Week 3: Diffusion SDEs)..."
                className="input flex-1"
              />
              <input
                type="text"
                value={newTopicWeek}
                onChange={(e) => setNewTopicWeek(e.target.value)}
                placeholder="Wk 3"
                className="input !w-20 font-mono"
              />
              <button type="submit" className="btn">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

/* ============================================================================
 * 5. WEEKLY REPEATING CLASS SCHEDULE MODAL
 * ========================================================================== */
interface ClassScheduleModalProps {
  isOpen: boolean;
  editingClass: ClassSchedule | null;
  onSelectEditClass: (cls: ClassSchedule | null) => void;
  onClose: () => void;
}

const DAY_LABELS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export const ClassScheduleModal: React.FC<ClassScheduleModalProps> = ({
  isOpen,
  editingClass,
  onSelectEditClass,
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const classSchedules = useAcademicStore((s) => s.classSchedules);
  const addClassSchedule = useAcademicStore((s) => s.addClassSchedule);
  const updateClassSchedule = useAcademicStore((s) => s.updateClassSchedule);
  const deleteClassSchedule = useAcademicStore((s) => s.deleteClassSchedule);

  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('Lecture');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [repeatUntil, setRepeatUntil] = useState('');

  useEffect(() => {
    if (editingClass) {
      setCourseId(editingClass.courseId);
      setTitle(editingClass.title);
      setDaysOfWeek(editingClass.daysOfWeek);
      setStartTime(editingClass.startTime);
      setEndTime(editingClass.endTime);
      setLocation(editingClass.location || '');
      setRepeatUntil(editingClass.repeatUntil || '');
    } else {
      setCourseId(courses[0]?.id || '');
      setTitle('Lecture');
      setDaysOfWeek([1, 3, 5]);
      setStartTime('10:00');
      setEndTime('11:00');
      setLocation('');
      setRepeatUntil('');
    }
  }, [editingClass, isOpen, courses]);

  if (!isOpen) return null;

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || daysOfWeek.length === 0) return;

    const payload = {
      courseId: courseId || courses[0]?.id || '',
      title: title.trim(),
      daysOfWeek,
      startTime,
      endTime,
      location: location.trim() || undefined,
      repeatUntil: repeatUntil || undefined,
    };

    if (editingClass) {
      updateClassSchedule(editingClass.id, payload);
      onSelectEditClass(null);
    } else {
      const created = addClassSchedule(payload);
      onSelectEditClass(created);
    }
  };

  return (
    <ModalShell
      title="Weekly Repeating Classes"
      subtitle="Add lectures, labs, or recitations — factored into future load predictions"
      width="max-w-lg"
      onClose={onClose}
    >
      <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
        {classSchedules.length > 0 && (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {classSchedules.map((cls) => {
              const course = courses.find((c) => c.id === cls.courseId);
              const daysStr = DAY_LABELS.filter((d) =>
                cls.daysOfWeek.includes(d.day)
              )
                .map((d) => d.label)
                .join(' · ');
              return (
                <div
                  key={cls.id}
                  onClick={() => onSelectEditClass(cls)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-app border border-line hover:border-line-strong cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Dot color={course?.colorHex} />
                    <span className="font-mono font-medium text-fg">
                      {course?.code || 'CLASS'}
                    </span>
                    <span className="text-fg truncate">{cls.title}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {daysStr} · {cls.startTime}–{cls.endTime}
                      {cls.repeatUntil ? ` · till ${cls.repeatUntil}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClassSchedule(cls.id);
                      if (editingClass?.id === cls.id) onSelectEditClass(null);
                    }}
                    className="icon-btn hover:!text-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 pt-2 border-t border-line"
        >
          <div className="flex items-center justify-between">
            <span className="section-label flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              {editingClass ? 'Edit Class' : 'Add Recurring Class'}
            </span>
            {editingClass && (
              <button
                type="button"
                onClick={() => onSelectEditClass(null)}
                className="text-[11px] text-info hover:underline"
              >
                + New Class
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="input"
              >
                <option value="">General / Unlinked</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Session Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lecture / Lab"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Repeats Weekly On</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map(({ day, label }) => {
                const active = daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] border transition-colors ${
                      active
                        ? 'bg-fg text-app border-fg font-semibold'
                        : 'bg-app text-muted border-line hover:text-fg'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">Repeating till</label>
              <input
                type="date"
                value={repeatUntil}
                onChange={(e) => setRepeatUntil(e.target.value)}
                title="Optional end date for repeating class"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="label">Room / Link</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="LH-301"
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-soft">
              Done
            </button>
            <button type="submit" className="btn-solid">
              {editingClass ? 'Save Class' : 'Add to Weekly Schedule'}
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};

/* ============================================================================
 * 6. MANUAL STUDY LOG MODAL (Registered Courses OR Outside Curriculum)
 * ========================================================================== */
interface StudyLogModalProps {
  isOpen: boolean;
  defaultCourseId?: string;
  onClose: () => void;
}

export const StudyLogModal: React.FC<StudyLogModalProps> = ({
  isOpen,
  defaultCourseId,
  onClose,
}) => {
  const courses = useAcademicStore((s) => s.courses);
  const addStudyLog = useAcademicStore((s) => s.addStudyLog);

  const [mode, setMode] = useState<'COURSE' | 'OUTSIDE'>('OUTSIDE');
  const [courseId, setCourseId] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [date, setDate] = useState(getTodayDateKey());
  const [minutes, setMinutes] = useState(45);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (defaultCourseId) {
      setMode('COURSE');
      setCourseId(defaultCourseId);
    } else if (courses.length === 0) {
      setMode('OUTSIDE');
      setCourseId('');
    } else {
      setMode('OUTSIDE');
      setCourseId(courses[0]?.id || '');
    }
    setCustomTopic('');
    setDate(getTodayDateKey());
    setMinutes(45);
    setNotes('');
  }, [isOpen, defaultCourseId, courses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'OUTSIDE' && !customTopic.trim()) return;
    if (mode === 'COURSE' && !courseId) return;

    addStudyLog({
      courseId: mode === 'COURSE' ? courseId : undefined,
      customTopic: mode === 'OUTSIDE' ? customTopic.trim() : undefined,
      date,
      minutes: Number(minutes) || 30,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <ModalShell
      title="Log Study Session"
      subtitle="Record study for a registered course or any topic outside your curriculum"
      width="max-w-md"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
        <div className="seg w-full">
          <button
            type="button"
            onClick={() => setMode('OUTSIDE')}
            className={`seg-item flex-1 ${mode === 'OUTSIDE' ? 'is-active' : ''}`}
          >
            Outside Curriculum / Custom
          </button>
          <button
            type="button"
            disabled={courses.length === 0}
            onClick={() => setMode('COURSE')}
            className={`seg-item flex-1 disabled:opacity-40 ${
              mode === 'COURSE' ? 'is-active' : ''
            }`}
          >
            Registered Course
          </button>
        </div>

        {mode === 'OUTSIDE' ? (
          <div>
            <label className="label">Topic / Subject Studied</label>
            <input
              type="text"
              required
              autoFocus
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g., Rust Async, System Design, Linear Algebra..."
              className="input"
            />
          </div>
        ) : (
          <div>
            <label className="label">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label">Duration (min)</label>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="input font-mono"
            />
          </div>
        </div>

        <div>
          <label className="label">What did you study? (Optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes on chapters, problems, or concepts..."
            className="input"
          />
        </div>

        <div className="pt-3 border-t border-line flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-soft">
            Cancel
          </button>
          <button type="submit" className="btn-solid">
            Save Study Log
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
