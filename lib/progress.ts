import { OrbitData, Revision, Subject, Topic } from './types';

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
  const percentage = Math.round(topics.reduce((sum, topic) => sum + topicCompletion(topic), 0) / Math.max(topics.length, 1));
  return {
    percentage,
    completed: topics.filter((topic) => topic.state === 'completed' && topic.checkpoints.every((checkpoint) => checkpoint.completed)).length,
    total: topics.length,
    currentModule: subject.modules.find((module) => module.topics.some((topic) => topic.state !== 'completed'))?.title ?? 'Complete',
  };
}

export function semesterProgress(data: OrbitData) {
  const subjects = data.semester.subjects;
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
