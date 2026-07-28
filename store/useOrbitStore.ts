'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createInitialData } from '@/lib/seed';
import { findTopic } from '@/lib/progress';
import { AppPage, LearningState, Note, OrbitData, StudyTask, UserPreferences } from '@/lib/types';

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
};

const initial = createInitialData();
const today = () => new Date().toISOString().slice(0, 10);
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const revisionOffsets = [1, 3, 7, 21] as const;

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
            tasks: [{ ...task, id: makeId('task'), completed: false, order: state.data.tasks.length }, ...state.data.tasks],
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
          data.semester.subjects.push({ id: makeId('subject'), name: name.trim(), shortName: name.trim().slice(0, 10), code: 'CUSTOM', credits: 0, accent: '#A78BFA', modules: [{ id: makeId('module'), title: 'Custom Module', topics: [] }], totalStudyHours: 0, assessmentReadiness: 0, custom: true });
          return { data };
        }),
      addCustomTopic: (subjectId, title) =>
        set((state) => {
          if (!title.trim()) return state;
          const data = structuredClone(state.data) as OrbitData;
          const subject = data.semester.subjects.find((item) => item.id === subjectId);
          if (!subject) return state;
          subject.modules[0].topics.push({ id: makeId('topic'), title: title.trim(), description: 'Custom topic added to this semester plan.', difficulty: 'Core', estimatedMinutes: 45, state: 'not-started', confidence: 1, checkpoints: ['concept', 'notes', 'code', 'questions', 'revision'].map((key) => ({ key: key as never, label: key, completed: false })), subtopics: [], resources: [], codingQuestions: [], custom: true });
          return { data };
        }),
      deleteCustomTopic: (topicId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          data.semester.subjects.forEach((subject) => subject.modules.forEach((module) => (module.topics = module.topics.filter((topic) => topic.id !== topicId || !topic.custom))));
          return { data, activeTopicId: state.activeTopicId === topicId ? undefined : state.activeTopicId };
        }),
      resetProgress: () => set({ data: createInitialData(), activeSubjectId: 'frontend', activeTopicId: undefined }),
      importData: (data) => set({ data }),
    }),
    {
      name: 'orbit-semester-os',
      partialize: (state) => ({ data: state.data, activeSubjectId: state.activeSubjectId }),
    },
  ),
);
