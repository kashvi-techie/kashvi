import { Module, Subject } from './types';

export type ParsedSyllabus = {
  subjects: Subject[];
  warnings: string[];
  mocked: boolean;
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const checklist = () => ['concept', 'notes', 'code', 'questions', 'revision'].map((key) => ({ key: key as never, label: key, completed: false }));

export async function parseSyllabus(file: File): Promise<ParsedSyllabus> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));
  return {
    subjects: [],
    warnings: [
      `${file.name} was received, but PDF parsing is mocked in development.`,
      'Connect an AI/document parsing API before importing parsed subjects automatically.',
    ],
    mocked: true,
  };
}

export function parsePlainTextSyllabus(text: string): ParsedSyllabus {
  const subjects = text
    .split(/\n(?=subject|course|paper|\d+\.)/i)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((block, index) => {
      const lines = block.split('\n').map((line) => line.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
      const name = lines[0] || `Imported Subject ${index + 1}`;
      const parsedModule: Module = {
        id: makeId('module'),
        title: 'Imported Module',
        custom: true,
        topics: lines.slice(1).map((title) => ({
          id: makeId('topic'),
          title,
          description: 'Imported from pasted syllabus text.',
          difficulty: 'Core',
          estimatedMinutes: 45,
          state: 'not-started',
          confidence: 1,
          checkpoints: checklist(),
          subtopics: [],
          resources: [],
          codingQuestions: [],
          custom: true,
        })),
      };
      return {
        id: makeId('subject'),
        name,
        shortName: name.slice(0, 12),
        code: 'IMPORT',
        credits: 0,
        accent: ['#A78BFA', '#78C6A3', '#D7AE68', '#8FC7FF'][index % 4],
        modules: [parsedModule],
        totalStudyHours: 0,
        assessmentReadiness: 0,
        custom: true,
        templateSource: 'import',
      } satisfies Subject;
    });

  return {
    subjects,
    warnings: subjects.length ? ['Plain-text parsing is heuristic. Review subjects, modules and topics before studying.'] : ['No subjects were detected in the pasted text.'],
    mocked: false,
  };
}
