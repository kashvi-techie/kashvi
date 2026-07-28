'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createEmptyData, createTemplateData, STORAGE_SCHEMA_VERSION } from '@/lib/seed';
import { findTopic } from '@/lib/progress';
import { normalizeForMatch } from '@/lib/syllabusImport';
import { ActivityRecord, AppPage, CheckpointKey, LearningState, Module, Note, OrbitData, Semester, StudyTask, Subject, Topic, TopicProgress, UserPreferences } from '@/lib/types';

export type ImportMode = 'add-semester' | 'merge-current' | 'replace-current';
export type OrbitBackup = { key: string; timestamp: string; reason: string; data: OrbitData };

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
  rescheduleTask: (taskId: string, date: string) => void;
  reorderTasks: (from: number, to: number) => void;
  addTask: (task: Omit<StudyTask, 'id' | 'order' | 'completed'>) => void;
  startFocus: (taskId?: string) => void;
  endFocus: (minutes?: number) => void;
  completeRevision: (revisionId: string, confidence: number) => void;
  addCustomSubject: (name: string) => void;
  addCustomTopic: (subjectId: string, title: string) => void;
  deleteCustomTopic: (topicId: string) => void;
  resetProgress: () => void;
  importData: (data: OrbitData, mode?: ImportMode) => void;
  restoreBackup: (key: string) => void;
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
const backupIndexKey = 'orbit-backups';

function activity(action: ActivityRecord['action'], partial: Omit<ActivityRecord, 'id' | 'timestamp' | 'action'> = {}): ActivityRecord {
  return { id: makeId('activity'), timestamp: new Date().toISOString(), action, ...partial };
}

export function listOrbitBackups(): OrbitBackup[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const keys = JSON.parse(localStorage.getItem(backupIndexKey) ?? '[]') as string[];
    return keys.map((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as OrbitBackup | null).filter(Boolean) as OrbitBackup[];
  } catch {
    return [];
  }
}

function saveBackup(data: OrbitData, reason: string) {
  if (typeof localStorage === 'undefined') return;
  const timestamp = new Date().toISOString();
  const key = `orbit-backup-${timestamp}`;
  const backup: OrbitBackup = { key, timestamp, reason, data: structuredClone(data) as OrbitData };
  const existing = listOrbitBackups();
  const next = [backup, ...existing].slice(0, 5);
  next.forEach((item) => localStorage.setItem(item.key, JSON.stringify(item)));
  existing.slice(4).forEach((item) => {
    if (!next.some((kept) => kept.key === item.key)) localStorage.removeItem(item.key);
  });
  localStorage.setItem(backupIndexKey, JSON.stringify(next.map((item) => item.key)));
}

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

function checkpointRecord(topic: Topic): TopicProgress['checkpoints'] {
  return Object.fromEntries(checkpointKeys.map((key) => [key, topic.checkpoints.find((checkpoint) => checkpoint.key === key)?.completed ?? false])) as TopicProgress['checkpoints'];
}

function progressFromTopic(topic: Topic): TopicProgress {
  return {
    topicId: topic.id,
    state: topic.state,
    confidence: topic.confidence,
    checkpoints: checkpointRecord(topic),
    important: !!topic.important,
    confusing: !!topic.confusing,
    lastActivity: topic.lastActivity,
    completedAt: topic.state === 'completed' ? topic.lastActivity ?? today() : undefined,
  };
}

function applyProgressToTopic(topic: Topic, progress?: TopicProgress) {
  const value = progress ?? progressFromTopic(topic);
  topic.state = value.state;
  topic.confidence = value.confidence;
  topic.important = value.important;
  topic.confusing = value.confusing;
  topic.lastActivity = value.lastActivity;
  topic.checkpoints = topic.checkpoints.map((checkpoint) => ({ ...checkpoint, completed: value.checkpoints[checkpoint.key] ?? false }));
}

function collectTopicProgress(semester: Semester, existing: Record<string, TopicProgress> = {}) {
  const topicProgress = { ...existing };
  semester.subjects.forEach((subject) => subject.modules.forEach((module) => module.topics.forEach((topic) => {
    topicProgress[topic.id] = topicProgress[topic.id] ?? progressFromTopic(topic);
    applyProgressToTopic(topic, topicProgress[topic.id]);
  })));
  return topicProgress;
}

function syncAllProgress(data: OrbitData) {
  data.topicProgress = collectTopicProgress(data.semester, data.topicProgress ?? {});
  data.semesters = (data.semesters?.length ? data.semesters : [data.semester]).map((semester) => {
    if (semester.id === data.semester.id) return data.semester;
    collectTopicProgress(semester, data.topicProgress);
    return semester;
  });
  data.activeSemesterId = data.activeSemesterId ?? data.semester.id;
  data.activity = data.activity ?? [];
  return data;
}

function normalizeData(input: unknown): OrbitData {
  const fallback = createEmptyData();
  if (!input || typeof input !== 'object') return fallback;
  const value = input as Partial<OrbitData>;
  if (!value.semester || !Array.isArray(value.semester.subjects)) return fallback;
  const normalized = {
    ...fallback,
    ...value,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    semester: {
      ...fallback.semester,
      ...value.semester,
      subjects: value.semester.subjects,
      createdAt: value.semester.createdAt ?? new Date().toISOString(),
    },
    activeSemesterId: value.activeSemesterId ?? value.semester.id,
    semesters: Array.isArray(value.semesters) && value.semesters.length ? value.semesters : [value.semester],
    topicProgress: value.topicProgress ?? {},
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    notes: Array.isArray(value.notes) ? value.notes : [],
    sessions: Array.isArray(value.sessions) ? value.sessions : [],
    activity: Array.isArray(value.activity) ? value.activity : [],
    streak: value.streak ?? { current: 0 },
    preferences: { ...fallback.preferences, ...value.preferences },
  };
  return syncAllProgress(normalized);
}

function stableCloneNewTopic(topic: Topic) {
  const copy = structuredClone(topic) as Topic;
  applyProgressToTopic(copy, {
    topicId: copy.id,
    state: 'not-started',
    confidence: 1,
    checkpoints: Object.fromEntries(checkpointKeys.map((key) => [key, false])) as TopicProgress['checkpoints'],
    important: false,
    confusing: false,
  });
  return copy;
}

function mergeSemesterIntoCurrent(current: OrbitData, incoming: OrbitData) {
  const data = structuredClone(current) as OrbitData;
  const imported = normalizeData(incoming).semester;
  imported.subjects.forEach((incomingSubject) => {
    const subject = data.semester.subjects.find((item) => (incomingSubject.code && normalizeForMatch(item.code) === normalizeForMatch(incomingSubject.code)) || normalizeForMatch(item.name) === normalizeForMatch(incomingSubject.name));
    if (!subject) {
      const newSubject = structuredClone(incomingSubject) as Subject;
      newSubject.modules = newSubject.modules.map((module) => ({ ...module, topics: module.topics.map(stableCloneNewTopic) }));
      data.semester.subjects.push(newSubject);
      return;
    }
    incomingSubject.modules.forEach((incomingModule) => {
      const moduleNumber = normalizeForMatch(incomingModule.title).match(/\d+/)?.[0];
      let targetModule = subject.modules.find((item) => normalizeForMatch(item.title) === normalizeForMatch(incomingModule.title) || (!!moduleNumber && normalizeForMatch(item.title).includes(moduleNumber)));
      if (!targetModule) {
        targetModule = { ...structuredClone(incomingModule), topics: [] };
        subject.modules.push(targetModule);
      }
      incomingModule.topics.forEach((incomingTopic) => {
        const exists = targetModule.topics.some((item) => normalizeForMatch(item.title) === normalizeForMatch(incomingTopic.title));
        if (!exists) targetModule.topics.push(stableCloneNewTopic(incomingTopic));
      });
    });
  });
  data.topicProgress = collectTopicProgress(data.semester, data.topicProgress);
  data.semesters = (data.semesters ?? [data.semester]).map((semester) => (semester.id === data.semester.id ? data.semester : semester));
  return data;
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
          const previous = data.topicProgress[topicId] ?? progressFromTopic(found.topic);
          data.topicProgress[topicId] = { ...previous, state: nextState, lastActivity: today(), completedAt: nextState === 'completed' ? today() : previous.completedAt };
          applyProgressToTopic(found.topic, data.topicProgress[topicId]);
          if (previous.state === 'not-started' && nextState !== 'not-started') data.activity.push(activity('topic_started', { subjectId: found.subject.id, moduleId: found.module.id, topicId }));
          if (nextState === 'completed') {
            data.topicProgress[topicId].checkpoints = Object.fromEntries(checkpointKeys.map((key) => [key, true])) as TopicProgress['checkpoints'];
            applyProgressToTopic(found.topic, data.topicProgress[topicId]);
            scheduleRevisions(data, found.subject.id, topicId);
            data.activity.push(activity('topic_completed', { subjectId: found.subject.id, moduleId: found.module.id, topicId }));
          }
          return { data };
        }),
      toggleCheckpoint: (topicId, checkpointKey) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (!found) return state;
          const key = checkpointKey as CheckpointKey;
          const previous = data.topicProgress[topicId] ?? progressFromTopic(found.topic);
          const checkpoints = { ...previous.checkpoints, [key]: !previous.checkpoints[key] };
          data.topicProgress[topicId] = { ...previous, checkpoints, lastActivity: today() };
          applyProgressToTopic(found.topic, data.topicProgress[topicId]);
          if (checkpoints[key]) data.activity.push(activity('checkpoint_completed', { subjectId: found.subject.id, moduleId: found.module.id, topicId, metadata: { checkpoint: key } }));
          const allDone = checkpointKeys.every((item) => checkpoints[item]);
          if (allDone && found.topic.state !== 'completed') {
            data.topicProgress[topicId].state = 'completed';
            data.topicProgress[topicId].completedAt = today();
            applyProgressToTopic(found.topic, data.topicProgress[topicId]);
            scheduleRevisions(data, found.subject.id, topicId);
            data.activity.push(activity('topic_completed', { subjectId: found.subject.id, moduleId: found.module.id, topicId }));
          } else if (!allDone && found.topic.state === 'completed') {
            data.topicProgress[topicId].state = 'practising';
            applyProgressToTopic(found.topic, data.topicProgress[topicId]);
          }
          return { data };
        }),
      updateTopicMeta: (topicId, patch) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          const found = findTopic(data, topicId);
          if (!found) return state;
          const previous = data.topicProgress[topicId] ?? progressFromTopic(found.topic);
          data.topicProgress[topicId] = { ...previous, ...patch, lastActivity: today() };
          applyProgressToTopic(found.topic, data.topicProgress[topicId]);
          if (patch.confidence !== undefined && patch.confidence !== previous.confidence) data.activity.push(activity('confidence_updated', { subjectId: found.subject.id, moduleId: found.module.id, topicId, metadata: { from: previous.confidence, to: patch.confidence } }));
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
        set((state) => ({ data: { ...state.data, notes: [{ ...note, id: makeId('note'), updatedAt: today() }, ...state.data.notes], activity: [activity('note_added', { subjectId: note.subjectId, moduleId: note.moduleId, topicId: note.topicId }), ...state.data.activity] } })),
      toggleTask: (taskId) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          data.tasks = data.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed, actualMinutes: task.completed ? undefined : task.estimatedMinutes } : task));
          const task = data.tasks.find((item) => item.id === taskId);
          if (task?.topicId && task.completed) {
            const found = findTopic(data, task.topicId);
            data.activity.push(activity('task_completed', { subjectId: task.subjectId, topicId: task.topicId, taskId: task.id, metadata: { minutes: task.estimatedMinutes } }));
            if (found && found.topic.state === 'not-started') {
              data.topicProgress[task.topicId] = { ...(data.topicProgress[task.topicId] ?? progressFromTopic(found.topic)), state: task.actionType === 'Practise' ? 'practising' : 'learning', lastActivity: today() };
              applyProgressToTopic(found.topic, data.topicProgress[task.topicId]);
            }
          }
          return { data };
        }),
      rescheduleTask: (taskId, date) =>
        set((state) => {
          const data = structuredClone(state.data) as OrbitData;
          data.tasks = data.tasks.map((task) => (task.id === taskId ? { ...task, scheduledFor: date } : task));
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
            data.activity.push(activity('study_session_completed', { subjectId: task.subjectId, topicId: task.topicId, taskId: task.id, metadata: { minutes } }));
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
          if (found) {
            const previous = data.topicProgress[revision.topicId] ?? progressFromTopic(found.topic);
            data.topicProgress[revision.topicId] = { ...previous, confidence, lastActivity: today() };
            applyProgressToTopic(found.topic, data.topicProgress[revision.topicId]);
            data.activity.push(activity('revision_completed', { subjectId: revision.subjectId, topicId: revision.topicId, metadata: { confidence } }));
          }
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
          const topic = { id: makeId('topic'), title: title.trim(), description: 'Custom topic added to this semester plan.', difficulty: 'Core' as const, estimatedMinutes: 45, state: 'not-started' as const, confidence: 1, checkpoints: checkpointKeys.map((key) => ({ key, label: key, completed: false })), subtopics: [], resources: [], codingQuestions: [], custom: true };
          targetModule.topics.push(topic);
          data.topicProgress[topic.id] = progressFromTopic(topic);
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
      importData: (incoming, mode = 'add-semester') => {
        set((state) => {
          saveBackup(state.data, `before-${mode}`);
          const imported = normalizeData(incoming);
          if (mode === 'merge-current') {
            const merged = mergeSemesterIntoCurrent(state.data, imported);
            return { data: { ...merged, preferences: { ...merged.preferences, onboardingComplete: true, setupMethod: 'import' } } };
          }
          if (mode === 'replace-current') {
            return { data: { ...imported, preferences: { ...state.data.preferences, ...imported.preferences, onboardingComplete: true, setupMethod: 'import' } }, activeSubjectId: imported.semester.subjects[0]?.id ?? '' };
          }
          const data = structuredClone(state.data) as OrbitData;
          data.semesters = [...(data.semesters ?? [data.semester]).filter((semester) => semester.id !== imported.semester.id), imported.semester];
          data.preferences = { ...data.preferences, onboardingComplete: true, setupMethod: 'import' };
          data.topicProgress = { ...data.topicProgress, ...collectTopicProgress(imported.semester, imported.topicProgress) };
          return { data };
        });
      },
      restoreBackup: (key) => {
        const backup = listOrbitBackups().find((item) => item.key === key);
        if (backup && confirm(`Restore backup from ${new Date(backup.timestamp).toLocaleString()}? Current state will be backed up first.`)) {
          set((state) => {
            saveBackup(state.data, 'before-restore');
            const data = normalizeData(backup.data);
            return { data, activeSubjectId: data.semester.subjects[0]?.id ?? '' };
          });
        }
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
        const data = normalizeData(maybeState?.data);
        if (maybeState?.data && maybeState.data.schemaVersion !== STORAGE_SCHEMA_VERSION) {
          saveBackup(maybeState.data as OrbitData, 'before-migration');
        }
        return { ...maybeState, data };
      },
      merge: (persisted, current) => {
        const maybeState = persisted as Partial<OrbitStore> | undefined;
        return { ...current, ...maybeState, data: normalizeData(maybeState?.data) };
      },
    },
  ),
);
