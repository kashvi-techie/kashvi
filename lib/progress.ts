import { OrbitData, Revision, StudyTask, Subject, Topic } from './types';

export const activeSubjects = (data: OrbitData) => data.semester.subjects.filter((subject) => !subject.archived);
export const allTopics = (subject: Subject) => subject.modules.flatMap((module) => module.topics);
export const allSubtopics = (subject: Subject) => allTopics(subject).flatMap((topic) => topic.subtopics);

export function topicCompletion(topic: Topic) {
  const topicChecks = topic.checkpoints.filter((checkpoint) => checkpoint.completed).length;
  const subtopicChecks = topic.subtopics.flatMap((subtopic) => subtopic.checkpoints).filter((checkpoint) => checkpoint.completed).length;
  const totalChecks = topic.checkpoints.length + topic.subtopics.length * 5;
  const stateBonus = topic.state === 'completed' ? 1 : topic.state === 'practising' ? 0.65 : topic.state === 'learning' ? 0.28 : 0;
  return Math.round(((topicChecks + subtopicChecks) / Math.max(totalChecks, 1) * 0.72 + stateBonus * 0.28) * 100);
}

export function subjectProgress(subject: Subject) {
  const topics = allTopics(subject);
  if (!topics.length) return { percentage: 0, completed: 0, total: 0, currentModule: 'No modules yet' };
  const percentage = Math.round(topics.reduce((sum, topic) => sum + topicCompletion(topic), 0) / Math.max(topics.length, 1));
  return {
    percentage,
    completed: topics.filter((topic) => topic.state === 'completed' && topic.checkpoints.every((checkpoint) => checkpoint.completed)).length,
    total: topics.length,
    currentModule: subject.modules.find((module) => module.topics.some((topic) => topic.state !== 'completed'))?.title ?? 'Complete',
  };
}

export function semesterProgress(data: OrbitData) {
  const subjects = activeSubjects(data);
  if (!subjects.length) return 0;
  return Math.round(subjects.reduce((sum, subject) => sum + subjectProgress(subject).percentage, 0) / subjects.length);
}

export function findSubject(data: OrbitData, subjectId: string) {
  return data.semester.subjects.find((subject) => subject.id === subjectId);
}

export function findTopic(data: OrbitData, topicId?: string) {
  if (!topicId) return undefined;
  for (const subject of data.semester.subjects) {
    for (const subjectModule of subject.modules) {
      const topic = subjectModule.topics.find((item) => item.id === topicId);
      if (topic) return { subject, module: subjectModule, topic };
    }
  }
  return undefined;
}

export function getStudyStreak(data: OrbitData) {
  const studyDates = new Set(data.sessions.map((session) => session.completedAt.slice(0, 10)));
  if (!studyDates.size) return 0;
  let cursor = new Date();
  let streak = 0;
  while (studyDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  if (streak > 0) return streak;
  cursor = new Date(Date.now() - 86400000);
  while (studyDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

export function weeklyActivity(data: OrbitData) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const sessions = data.sessions.filter((session) => session.completedAt.slice(0, 10) === iso);
    const completedTasks = data.tasks.filter((task) => task.completed && task.scheduledFor === iso);
    return {
      day: labels[date.getDay()],
      date: iso,
      minutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
      topics: completedTasks.filter((task) => task.topicId).length,
      questions: completedTasks.filter((task) => task.actionType === 'Practise').length,
    };
  });
  return days;
}

function taskReason(data: OrbitData, task: StudyTask) {
  const found = findTopic(data, task.topicId);
  if (!found) return `Recommended because it is a ${task.priority.toLowerCase()} priority task scheduled for today.`;
  return `Recommended because ${found.topic.title} is ready for ${task.actionType.toLowerCase()} and is already in today's plan.`;
}

export function recommendedNextTask(data: OrbitData, currentSubjectId?: string) {
  const overdue = data.revisions.find((revision) => revisionStatus(revision) === 'overdue');
  if (overdue) {
    const found = findTopic(data, overdue.topicId);
    return {
      title: found ? `Revise ${found.topic.title}` : 'Complete overdue revision',
      subjectId: overdue.subjectId,
      topicId: overdue.topicId,
      actionType: 'Revise' as const,
      estimatedMinutes: 25,
      reason: found ? `Recommended because revision ${overdue.round} is overdue for ${found.subject.shortName}.` : 'Recommended because a revision is overdue.',
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const planned = data.tasks.filter((task) => task.scheduledFor === today && !task.completed).sort((a, b) => a.order - b.order)[0];
  if (planned) {
    return { ...planned, reason: taskReason(data, planned) };
  }

  const subjects = activeSubjects(data);
  const inProgress = subjects.flatMap((subject) => allTopics(subject).map((topic) => ({ subject, topic }))).find(({ topic }) => topic.state === 'learning' || topic.state === 'practising');
  if (inProgress) {
    return {
      title: `${inProgress.topic.state === 'practising' ? 'Practise' : 'Learn'} ${inProgress.topic.title}`,
      subjectId: inProgress.subject.id,
      topicId: inProgress.topic.id,
      actionType: inProgress.topic.state === 'practising' ? 'Practise' as const : 'Learn' as const,
      estimatedMinutes: inProgress.topic.estimatedMinutes,
      reason: `Recommended because ${inProgress.topic.title} is currently ${inProgress.topic.state}.`,
    };
  }

  const lowConfidence = subjects
    .flatMap((subject) => allTopics(subject).filter((topic) => topic.state !== 'completed').map((topic) => ({ subject, topic })))
    .sort((a, b) => a.topic.confidence - b.topic.confidence)[0];
  if (lowConfidence) {
    return {
      title: `Learn ${lowConfidence.topic.title}`,
      subjectId: lowConfidence.subject.id,
      topicId: lowConfidence.topic.id,
      actionType: 'Learn' as const,
      estimatedMinutes: lowConfidence.topic.estimatedMinutes,
      reason: `Recommended because your confidence is ${lowConfidence.topic.confidence}/5.`,
    };
  }

  const current = subjects.find((subject) => subject.id === currentSubjectId) ?? subjects[0];
  const next = current ? allTopics(current).find((topic) => topic.state === 'not-started') : undefined;
  if (current && next) {
    return {
      title: `Learn ${next.title}`,
      subjectId: current.id,
      topicId: next.id,
      actionType: 'Learn' as const,
      estimatedMinutes: next.estimatedMinutes,
      reason: `Recommended because it is the next unstarted topic in ${current.shortName}.`,
    };
  }

  return {
    title: 'Create your first subject',
    subjectId: subjects[0]?.id ?? '',
    actionType: 'Learn' as const,
    estimatedMinutes: 20,
    reason: 'Recommended because your semester has no active study items yet.',
  };
}

export function revisionStatus(revision: Revision) {
  if (revision.completedAt) return 'completed';
  const today = new Date().toISOString().slice(0, 10);
  if (revision.dueDate < today) return 'overdue';
  if (revision.dueDate === today) return 'due';
  return 'upcoming';
}

export function searchData(data: OrbitData, query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return [];
  const results: { id: string; type: string; title: string; path: string }[] = [];
  data.semester.subjects.forEach((subject) => {
    if (subject.name.toLowerCase().includes(value) || subject.code.toLowerCase().includes(value)) {
      results.push({ id: subject.id, type: 'Subject', title: subject.name, path: subject.name });
    }
    subject.modules.forEach((module) => {
      if (module.title.toLowerCase().includes(value)) results.push({ id: module.id, type: 'Module', title: module.title, path: `${subject.name} -> ${module.title}` });
      module.topics.forEach((topic) => {
        if (topic.title.toLowerCase().includes(value)) results.push({ id: topic.id, type: 'Topic', title: topic.title, path: `${subject.name} -> ${module.title} -> ${topic.title}` });
        topic.subtopics.forEach((subtopic) => {
          if (subtopic.title.toLowerCase().includes(value)) results.push({ id: subtopic.id, type: 'Subtopic', title: subtopic.title, path: `${subject.name} -> ${module.title} -> ${topic.title} -> ${subtopic.title}` });
        });
      });
    });
  });
  data.notes.forEach((note) => {
    if (`${note.title} ${note.body}`.toLowerCase().includes(value)) results.push({ id: note.id, type: 'Note', title: note.title, path: `Notes -> ${note.title}` });
  });
  data.tasks.forEach((task) => {
    if (task.title.toLowerCase().includes(value)) results.push({ id: task.id, type: 'Practice task', title: task.title, path: `Today -> ${task.actionType} -> ${task.title}` });
  });
  return results.slice(0, 12);
}
