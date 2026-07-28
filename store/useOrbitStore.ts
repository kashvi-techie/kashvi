'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createEmptyData, createTemplateData, STORAGE_SCHEMA_VERSION } from '@/lib/seed';
import { findTopic } from '@/lib/progress';
import { AppPage, LearningState, Module, Note, OrbitData, StudyTask, Subject, UserPreferences } from '@/lib/types';

type OrbitStore = {
  data: OrbitData;
  activePage: AppPage;
  activeSubjectId: string;
  activeTopicId?: string;
  focusTaskId?: string;
  searchOpen: boolean;
  setPage: (page: AppPage) => void;
  setSubject: (subjectId: string) => void;
  setTopic: (topicId?: string) => void;
  setSearchOpen: (open: boolean) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  completeOnboarding: (preferences?: Partial<UserPreferences>) => void;
  updateTopicState: (topicId: string, state: LearningState) => void;
  toggleCheckpoint: (topicId: string, checkpointKey: string) => void;
  updateTopicMeta: (topicId: string, patch: { confidence?: number; important?: boolean; confusing?: boolean; dueDate?: string }) => void;
  addResource: (topicId: string, resource: string) => void;
  addCodingQuestion: (topicId: string, question: string) => void;
  addNote: (note: Omit<Note, 'id' | 'updatedAt'>) => void;
  toggleTask: (taskId: string) => void;
  reorderTasks: (from: number, to: number) => void;
  addTask: (task: Omit<StudyTask, 'id' | 'order' | 'completed'>) => void;
  startFocus: (taskId?: string) => void;
  endFocus: (minutes?: number) => void;
  completeRevision: (revisionId: string, confidence: number) => void;
  addCustomSubject: (name: string) => void;
  addCustomTopic: (subjectId: string, title: string) => void;
  deleteCustomTopic: (topicId: string) => void;
  resetProgress: () => void;
  importData: (data: OrbitData) => void;
  useTemplate: (semesterTitle: string) => void;
  createSemester: (title: string, program: string) => void;
  updateSubject: (subjectId: string, patch: Partial<Pick<Subject, 'name' | 'code' | 'credits'>>) => void;
  addModule: (subjectId: string, title: string) => void;
  addSubtopic: (topicId: string, title: string) => void;
  duplicateSubject: (subjectId: string) => void;
  archiveSubject: (subjectId: string) => void;
  deleteCustomSubject: (subjectId: string) => void;
};

const initial = createEmptyData();
const today = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const revisionOffsets = [1, 3, 7, 21] as const;
const checkpointKeys = ['concept', 'notes', 'code', 'questions', 'revision'] as const;

function scheduleRevisions(data: OrbitData, subjectId: string, topicId: string) {
  const existing = new Set(data.revisions.filter((revision) => revision.topicId === topicId).map((revision) => revision.round));
  revisionOffsets.forEach((offset, index) => {
    const round = (index + 1) as 1 | 2 | 3 | 4;
    if (!existing.has(round)) {
      const dueDate = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
      data.revisions.push({ id: makeId('rev'), subjectId, topicId, round, dueDate });
    }
  });
}

function makeModule(title: string): Module {
  return { id: makeId('module'), title, topics: [], custom: true };
}

function normalizeData(input: unknown): OrbitData {
  const fallback = createEmptyData();
  if (!input || typeof input !== 'object') return fallback;
  const value = input as Partial<OrbitData>;
  if (!value.semester || !Array.isArray(value.semester.subjects)) return fallback;
  return {
    ...fallback,
    ...value,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    semester: {
      ...fallback.semester,
      ...value.semester,
      subjects: value.semester.subjects,
      createdAt: value.semester.createdAt ?? new Date().toISOString(),
    },
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    streak: value.streak ?? { current: 0 },
    preferences: { ...fallback.preferences, ...value.preferences },
  };
}

export const useOrbitStore = create<OrbitStore>()(
  persist(
    (set, get) => ({
      data: initial,
      activePage: 'overview',
      activeSubjectId: 'frontend',
      activeTopicId: undefined,
      searchOpen: false,
      setPage: (page) => set({ activePage: page }),
      setSubject: (subjectId) => set({ activeSubjectId: subjectId, activePage: 'subjects' }),
      setTopic: (topicId) => set({ activeTopicId: topicId }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      updatePreferences: (preferences) =>
        set((state) => ({ data: { ...state.data, preferences: { ...state.data.preferences, ...preferences } } })),
      completeOnboarding: (preferences) =>
        set((state) => ({ data: { ...state.data, preferences: { ...state.data.preferences, ...preferences, onboardingComplete: true } } })),
      updateTopicState: (topicId, nextState) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (!found) return state;
          found.topic.state = nextState;
          found.topic.lastActivity = today();
          if (nextState === 'completed') {
            found.topic.checkpoints = found.topic.checkpoints.map((checkpoint) => ({ ...checkpoint, completed: true }));
            scheduleRevisions(data, found.subject.id, topicId);
          }
          return { data };
        }),
      toggleCheckpoint: (topicId, checkpointKey) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (!found) return state;
          found.topic.checkpoints = found.topic.checkpoints.map((checkpoint) =>
            checkpoint.key === checkpointKey ? { ...checkpoint, completed: !checkpoint.completed } : checkpoint,
          );
          found.topic.lastActivity = today();
          const allDone = found.topic.checkpoints.every((checkpoint) => checkpoint.completed);
          if (allDone && found.topic.state !== 'completed') {
            found.topic.state = 'completed';
            scheduleRevisions(data, found.subject.id, topicId);
          } else if (!allDone && found.topic.state === 'completed') {
            found.topic.state = 'practising';
          }
          return { data };
        }),
      updateTopicMeta: (topicId, patch) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (!found) return state;
          Object.assign(found.topic, patch);
          found.topic.lastActivity = today();
          return { data };
        }),
      addResource: (topicId, resource) =>
        set((state) => {
          if (!resource.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (found) found.topic.resources.push(resource.trim());
          return { data };
        }),
      addCodingQuestion: (topicId, question) =>
        set((state) => {
          if (!question.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (found) found.topic.codingQuestions.push(question.trim());
          return { data };
        }),
      addNote: (note) =>
        set((state) => ({ data: { ...state.data, notes: [{ ...note, id: makeId('note'), updatedAt: today() }, ...state.data.notes] } })),
      toggleTask: (taskId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          data.tasks = data.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed, actualMinutes: task.completed ? undefined : task.estimatedMinutes } : task));
          const task = data.tasks.find((item) => item.id === taskId);
          if (task?.topicId && task.completed) {
            const found = findTopic(data, task.topicId);
            if (found && found.topic.state === 'not-started') found.topic.state = task.actionType === 'Practise' ? 'practising' : 'learning';
          }
          return { data };
        }),
      reorderTasks: (from, to) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const todays = data.tasks.filter((task) => task.scheduledFor === today()).sort((a, b) => a.order - b.order);
          const [moved] = todays.splice(from, 1);
          todays.splice(to, 0, moved);
          todays.forEach((task, index) => {
            const target = data.tasks.find((item) => item.id === task.id);
            if (target) target.order = index;
          });
          return { data };
        }),
      addTask: (task) =>
        set((state) => ({
          data: {
            ...state.data,
            tasks: [{ ...task, title: task.title.trim(), id: makeId('task'), completed: false, order: state.data.tasks.length }, ...state.data.tasks],
          },
        })),
      startFocus: (taskId) => set({ focusTaskId: taskId ?? get().data.tasks.find((task) => !task.completed)?.id }),
      endFocus: (minutes = 25) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const task = data.tasks.find((item) => item.id === state.focusTaskId);
          if (task) {
            task.completed = true;
            task.actualMinutes = minutes;
            data.sessions.push({ id: makeId('session'), taskId: task.id, subjectId: task.subjectId, topicId: task.topicId, minutes, completedAt: today() });
            data.streak.lastStudyDate = today();
          }
          return { data, focusTaskId: undefined };
        }),
      completeRevision: (revisionId, confidence) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const revision = data.revisions.find((item) => item.id === revisionId);
          if (!revision) return state;
          revision.completedAt = today();
          revision.confidenceAfter = confidence;
          const found = findTopic(data, revision.topicId);
          if (found) found.topic.confidence = confidence;
          if (confidence <= 2) data.revisions.push({ id: makeId('rev'), subjectId: revision.subjectId, topicId: revision.topicId, round: revision.round, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
          return { data };
        }),
      addCustomSubject: (name) =>
        set((state) => {
          if (!name.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          data.semester.subjects.push({ id: makeId('subject'), name: name.trim(), shortName: name.trim().slice(0, 10), code: 'CUSTOM', credits: 0, accent: '#A78BFA', modules: [makeModule('Module I')], totalStudyHours: 0, assessmentReadiness: 0, custom: true, templateSource: 'manual' });
          return { data };
        }),
      addCustomTopic: (subjectId, title) =>
        set((state) => {
          if (!title.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (!subject) return state;
          const targetModule = subject.modules[0] ?? makeModule('Module I');
          if (!subject.modules.length) subject.modules.push(targetModule);
          targetModule.topics.push({ id: makeId('topic'), title: title.trim(), description: 'Custom topic added to this semester plan.', difficulty: 'Core', estimatedMinutes: 45, state: 'not-started', confidence: 1, checkpoints: checkpointKeys.map((key) => ({ key, label: key, completed: false })), subtopics: [], resources: [], codingQuestions: [], custom: true });
          return { data };
        }),
      deleteCustomTopic: (topicId) =>
        set((state) => {
          if (!confirm('Delete this custom topic?')) return state;
          const data = structuredClone(state.data) as OrbitData;
          data.semester.subjects.forEach((subject) => subject.modules.forEach((module) => (module.topics = module.topics.filter((topic) => topic.id !== topicId || !topic.custom))));
          return { data, activeTopicId: state.activeTopicId === topicId ? undefined : state.activeTopicId };
        }),
      resetProgress: () => set({ data: createEmptyData(), activeSubjectId: '', activeTopicId: undefined }),
      importData: (data) => {
        const normalized = normalizeData(data);
        set({ data: { ...normalized, preferences: { ...normalized.preferences, onboardingComplete: true, setupMethod: 'import' } }, activeSubjectId: normalized.semester.subjects[0]?.id ?? '' });
      },
      useTemplate: (semesterTitle) => {
        const data = createTemplateData();
        data.semester.title = semesterTitle.trim() || data.semester.title;
        data.preferences.onboardingComplete = true;
        set({ data, activeSubjectId: data.semester.subjects[0]?.id ?? '' });
      },
      createSemester: (title, program) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          data.semester = { id: makeId('semester'), title: title.trim() || 'My Semester', program: program.trim() || 'Academic program', subjects: [], createdAt: new Date().toISOString(), templateSource: 'manual' };
          data.tasks = [];
          data.revisions = [];
          data.notes = [];
          data.sessions = [];
          data.streak = { current: 0 };
          data.preferences.onboardingComplete = true;
          data.preferences.setupMethod = 'manual';
          return { data, activeSubjectId: '', activeTopicId: undefined };
        }),
      updateSubject: (subjectId, patch) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (!subject) return state;
          Object.assign(subject, patch);
          subject.shortName = subject.name.slice(0, 12);
          return { data };
        }),
      addModule: (subjectId, title) =>
        set((state) => {
          if (!title.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (subject) subject.modules.push(makeModule(title.trim()));
          return { data };
        }),
      addSubtopic: (topicId, title) =>
        set((state) => {
          if (!title.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (found) {
            found.topic.subtopics.push({ id: makeId('subtopic'), title: title.trim(), state: 'not-started', checkpoints: checkpointKeys.map((key) => ({ key, label: key, completed: false })), confidence: 1, estimatedMinutes: 25 });
          }
          return { data };
        }),
      duplicateSubject: (subjectId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (!subject) return state;
          const copy = structuredClone(subject) as Subject;
          copy.id = makeId('subject');
          copy.name = `${subject.name} Copy`;
          copy.shortName = `${subject.shortName} Copy`.slice(0, 12);
          copy.custom = true;
          copy.archived = false;
          copy.modules = copy.modules.map((module) => ({ ...module, id: makeId('module'), custom: true, topics: module.topics.map((topic) => ({ ...topic, id: makeId('topic'), custom: true })) }));
          data.semester.subjects.push(copy);
          return { data };
        }),
      archiveSubject: (subjectId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (subject && confirm(`Archive ${subject.name}? It will disappear from active progress but remain stored.`)) subject.archived = true;
          return { data };
        }),
      deleteCustomSubject: (subjectId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (!subject?.custom || !confirm(`Delete ${subject.name}? This cannot be undone.`)) return state;
          data.semester.subjects = data.semester.subjects.filter((item) => item.id !== subjectId);
          return { data, activeSubjectId: data.semester.subjects[0]?.id ?? '' };
        }),
    }),
    {
      name: 'orbit-semester-os',
      version: STORAGE_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ data: state.data, activeSubjectId: state.activeSubjectId }),
      migrate: (persisted) => {
        const maybeState = persisted as Partial<OrbitStore> | undefined;
        return { ...maybeState, data: normalizeData(maybeState?.data) };
      },
      merge: (persisted, current) => {
        const maybeState = persisted as Partial<OrbitStore> | undefined;
        return { ...current, ...maybeState, data: normalizeData(maybeState?.data) };
      },
    },
  ),
);
