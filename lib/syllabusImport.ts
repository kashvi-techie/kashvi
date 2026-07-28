import { CheckpointKey, Difficulty, Module, OrbitData, Semester, Subject, Topic } from './types';

export type SyllabusStats = {
  subjectCount: number;
  moduleCount: number;
  topicCount: number;
  subtopicCount: number;
  estimatedStudyHours: number;
  weeklyPace: string;
  difficultyRanking: { subjectId: string; subject: string; score: number; label: string }[];
};

export type ExtractedSyllabus = {
  semester: Semester;
  stats: SyllabusStats;
  warnings: string[];
  provider: 'rule-based-pdf' | 'rule-based-text' | 'llm-ready';
  rawText: string;
};

export type SyllabusParserProvider = {
  id: ExtractedSyllabus['provider'];
  extract: (input: File | string) => Promise<ExtractedSyllabus>;
};

const accents = ['#A78BFA', '#78C6A3', '#D7AE68', '#8FC7FF', '#E08282', '#B9A7FF'];
const checkpointKeys: CheckpointKey[] = ['concept', 'notes', 'code', 'questions', 'revision'];
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const checklist = () => checkpointKeys.map((key) => ({ key, label: checkpointLabel(key), completed: false }));

export async function extractSyllabus(file: File): Promise<ExtractedSyllabus> {
  return ruleBasedPdfProvider.extract(file);
}

export async function extractSyllabusText(text: string): Promise<ExtractedSyllabus> {
  return ruleBasedTextProvider.extract(text);
}

export function extractedToOrbitData(extracted: ExtractedSyllabus, preferences: OrbitData['preferences']): OrbitData {
  return {
    schemaVersion: 3,
    activeSemesterId: extracted.semester.id,
    semesters: [extracted.semester],
    semester: extracted.semester,
    topicProgress: {},
    tasks: [],
    revisions: [],
    notes: [],
    sessions: [],
    activity: [],
    streak: { current: 0 },
    preferences: { ...preferences, onboardingComplete: true, setupMethod: 'import' },
  };
}

const ruleBasedPdfProvider: SyllabusParserProvider = {
  id: 'rule-based-pdf',
  async extract(input) {
    if (typeof input === 'string') return buildExtraction(input, 'rule-based-text');
    const bytes = new Uint8Array(await input.arrayBuffer());
    const text = normalizeText(await extractPdfText(bytes));
    const fallbackName = input.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
    return buildExtraction(text || fallbackName, 'rule-based-pdf', text ? [] : ['PDF text extraction found little readable text. The preview may need manual correction.']);
  },
};

const ruleBasedTextProvider: SyllabusParserProvider = {
  id: 'rule-based-text',
  async extract(input) {
    return buildExtraction(typeof input === 'string' ? input : await input.text(), 'rule-based-text');
  },
};

async function extractPdfText(bytes: Uint8Array) {
  const decoder = new TextDecoder('latin1');
  const source = decoder.decode(bytes);
  const chunks: string[] = [source];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(source))) {
    const dictionary = match[1];
    const stream = match[2];
    if (/FlateDecode/i.test(dictionary) && 'DecompressionStream' in globalThis) {
      const binary = Uint8Array.from(stream, (char) => char.charCodeAt(0) & 255);
      try {
        chunks.push(await inflate(binary));
      } catch {
        chunks.push(stream);
      }
    } else {
      chunks.push(stream);
    }
  }
  return chunks.map(decodePdfStrings).join('\n');
}

async function inflate(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate'));
  const inflated = await new Response(stream).arrayBuffer();
  return new TextDecoder('latin1').decode(inflated);
}

function decodePdfStrings(text: string) {
  const strings: string[] = [];
  text.replace(/\((?:\\.|[^\\)])*\)/g, (value) => {
    strings.push(value.slice(1, -1).replace(/\\([nrtbf()\\])/g, (_, char: string) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' })[char] ?? char));
    return value;
  });
  text.replace(/<([0-9a-fA-F\s]{8,})>/g, (_, hex: string) => {
    const clean = hex.replace(/\s+/g, '');
    const chars = clean.match(/.{2}/g)?.map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join('');
    if (chars) strings.push(chars);
    return hex;
  });
  return strings.length ? strings.join('\n') : text;
}

function buildExtraction(raw: string, provider: ExtractedSyllabus['provider'], warnings: string[] = []): ExtractedSyllabus {
  const text = normalizeText(raw);
  const semesterTitle = detectSemesterTitle(text);
  const subjectBlocks = detectSubjectBlocks(text);
  const subjects = subjectBlocks.length ? subjectBlocks.map(blockToSubject) : [blockToSubject({ heading: 'Imported Subject', body: text, index: 0 })];
  const semester: Semester = {
    id: stableId('semester', semesterTitle),
    title: semesterTitle,
    program: 'Imported syllabus',
    subjects,
    createdAt: new Date().toISOString(),
    templateSource: 'import',
  };
  applyStableHierarchyIds(semester);
  const stats = calculateSyllabusStats(semester);
  return {
    semester,
    stats,
    provider,
    rawText: text,
    warnings: [
      ...warnings,
      'Rule-based extraction can handle common university formats, but review the preview before importing.',
      provider === 'rule-based-pdf' ? 'LLM enhancement provider is ready to plug in later without changing the review UI.' : 'Plain-text extraction used the same review pipeline as PDF imports.',
    ],
  };
}

function detectSemesterTitle(text: string) {
  const semesterMatch = text.match(/(?:semester|sem)\s*[-:]?\s*([ivxlcdm]+|\d+)(?:\s*[-:]\s*([^\n]{3,80}))?/i);
  if (semesterMatch) return `Semester ${semesterMatch[1].toUpperCase()}${semesterMatch[2] ? ` - ${semesterMatch[2].trim()}` : ''}`;
  const schemeMatch = text.match(/(?:b\.?tech|bachelor|mca|bca|programme|program)[^\n]{0,80}/i);
  return schemeMatch ? schemeMatch[0].trim() : 'Imported Semester';
}

function detectSubjectBlocks(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isSubjectHeading(line));
  if (!starts.length) {
    const coarse = text.split(/\n(?=(?:course|subject|paper)\s*(?:code|title|name)?\b|[A-Z]{2,5}\s*[- ]?\d{2,4})/i).filter((block) => block.trim().length > 40);
    return coarse.map((block, index) => {
      const [heading = `Imported Subject ${index + 1}`, ...body] = block.split('\n');
      return { heading: heading.trim(), body: body.join('\n'), index };
    });
  }
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    return { heading: start.line, body: lines.slice(start.index + 1, end).join('\n'), index: position };
  });
}

function isSubjectHeading(line: string) {
  if (line.length > 140) return false;
  return /(?:course|subject|paper)\s*(?:code|title|name)?/i.test(line)
    || /^[A-Z]{2,6}\s*[- ]?\d{2,4}\b/.test(line)
    || /\b[A-Z]{2,6}\s*[- ]?\d{2,4}\b.*(?:credits?|L-T-P)/i.test(line);
}

function blockToSubject({ heading, body, index }: { heading: string; body: string; index: number }): Subject {
  const combined = `${heading}\n${body}`;
  const code = combined.match(/\b[A-Z]{2,6}\s*[- ]?\d{2,4}\b/)?.[0]?.replace(/\s+/, '-') ?? `SUB-${index + 1}`;
  const credits = Number(combined.match(/(?:credits?|cr)\s*[:=-]?\s*(\d+)/i)?.[1] ?? combined.match(/\b(\d)\s*credits?\b/i)?.[1] ?? 0);
  const name = cleanSubjectName(heading, code, index);
  const modules = detectModules(body || heading).map((module, moduleIndex) => blockToModule(module, moduleIndex));
  return {
    id: makeId('subject'),
    name,
    shortName: name.slice(0, 12),
    code,
    credits,
    accent: accents[index % accents.length],
    modules: modules.length ? modules : [blockToModule({ title: 'Unit I', body: body || heading }, 0)],
    totalStudyHours: 0,
    assessmentReadiness: 0,
    custom: true,
    templateSource: 'import',
  };
}

function cleanSubjectName(heading: string, code: string, index: number) {
  const cleaned = heading
    .replace(code, '')
    .replace(/(?:course|subject|paper)\s*(?:code|title|name)?\s*[:=-]?/gi, '')
    .replace(/credits?.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned && cleaned.length > 2 ? cleaned : `Imported Subject ${index + 1}`;
}

function detectModules(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const starts = lines.map((line, index) => ({ line, index })).filter(({ line }) => /^(module|unit|part)\s*[-:]?\s*([ivxlcdm]+|\d+)/i.test(line));
  if (!starts.length) return [{ title: 'Imported Module', body: text }];
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    const [moduleTitle, inlineBody = ''] = start.line.split(/\s*:\s*/, 2);
    return { title: moduleTitle.replace(/\s+/g, ' ').slice(0, 90), body: [inlineBody, ...lines.slice(start.index + 1, end)].filter(Boolean).join('\n') };
  });
}

function blockToModule({ title, body }: { title: string; body: string }, moduleIndex: number): Module {
  return {
    id: makeId('module'),
    title: title || `Unit ${moduleIndex + 1}`,
    custom: true,
    topics: detectTopics(body).map((topic, index) => blockToTopic(topic, index)),
  };
}

function detectTopics(text: string) {
  const lines = text.split(/\n|;|•|\u2022/).map((line) => line.replace(/^[-*\d.)\s]+/, '').trim()).filter((line) => line.length > 2);
  const joined = lines.length > 1 ? lines : text.split(/,(?=\s*[A-Z])/).map((item) => item.trim()).filter(Boolean);
  return joined.slice(0, 30);
}

function blockToTopic(line: string, index: number): Topic {
  const pieces = line.split(/\s*[:>-]\s*/).filter(Boolean);
  const title = (pieces[0] || `Imported Topic ${index + 1}`).slice(0, 120);
  const subtopics = pieces.slice(1).join(' ').split(/,|\band\b/i).map((item) => item.trim()).filter((item) => item.length > 2).slice(0, 8);
  return {
    id: makeId('topic'),
    title,
    description: line,
    difficulty: detectDifficulty(line),
    estimatedMinutes: estimateMinutes(line, subtopics.length),
    state: 'not-started',
    confidence: 1,
    checkpoints: checklist(),
    subtopics: subtopics.map((subtopic) => ({
      id: makeId('subtopic'),
      title: subtopic,
      state: 'not-started',
      checkpoints: checklist(),
      confidence: 1,
      estimatedMinutes: 25,
    })),
    resources: [],
    codingQuestions: [],
    custom: true,
  };
}

function detectDifficulty(text: string): Difficulty {
  if (/lab|practical|implementation|program/i.test(text)) return 'Lab';
  if (/advanced|complex|optimization|compiler|machine learning|algorithm/i.test(text)) return 'Hard';
  if (/introduction|basics|overview|fundamental/i.test(text)) return 'Foundation';
  return 'Core';
}

function estimateMinutes(text: string, subtopicCount: number) {
  const base = detectDifficulty(text) === 'Hard' ? 75 : detectDifficulty(text) === 'Lab' ? 70 : 45;
  return base + subtopicCount * 15;
}

export function calculateSyllabusStats(semester: Semester): SyllabusStats {
  const subjects = semester.subjects;
  const modules = subjects.flatMap((subject) => subject.modules);
  const topics = modules.flatMap((module) => module.topics);
  const subtopicCount = topics.reduce((sum, topic) => sum + topic.subtopics.length, 0);
  const estimatedStudyHours = Math.ceil(topics.reduce((sum, topic) => sum + topic.estimatedMinutes + topic.subtopics.length * 20, 0) / 60);
  const difficultyRanking = subjects
    .map((subject) => {
      const subjectTopics = subject.modules.flatMap((module) => module.topics);
      const score = subjectTopics.reduce((sum, topic) => sum + ({ Foundation: 1, Core: 2, Lab: 2.5, Hard: 3 }[topic.difficulty]), 0) / Math.max(subjectTopics.length, 1);
      return { subjectId: subject.id, subject: subject.name, score: Number(score.toFixed(1)), label: score >= 2.6 ? 'Hard' : score >= 2 ? 'Moderate' : 'Foundation-heavy' };
    })
    .sort((a, b) => b.score - a.score);
  return {
    subjectCount: subjects.length,
    moduleCount: modules.length,
    topicCount: topics.length,
    subtopicCount,
    estimatedStudyHours,
    weeklyPace: `${Math.max(2, Math.ceil(estimatedStudyHours / 14))} hours/week for a 14-week semester`,
    difficultyRanking,
  };
}

function checkpointLabel(key: CheckpointKey) {
  return {
    concept: 'Concept understood',
    notes: 'Notes completed',
    code: 'Practical or code completed',
    questions: 'Questions practised',
    revision: 'Revision completed',
  }[key];
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z])([A-Z][a-z])/g, '$1\n$2')
    .trim();
}

export function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(i|1st|one)\b/g, '1')
    .replace(/\b(ii|2nd|two)\b/g, '2')
    .replace(/\b(iii|3rd|three)\b/g, '3')
    .replace(/\b(iv|4th|four)\b/g, '4')
    .replace(/\b(v|5th|five)\b/g, '5')
    .replace(/\b(module|unit|part)\s+/g, 'module ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stableId(prefix: string, ...parts: string[]) {
  return `${prefix}-${normalizeForMatch(parts.filter(Boolean).join('-')) || 'imported'}`;
}

function applyStableHierarchyIds(semester: Semester) {
  semester.subjects.forEach((subject) => {
    const subjectSeed = subject.code !== 'IMPORT' ? subject.code : subject.name;
    subject.id = stableId(semester.id, subjectSeed);
    subject.modules.forEach((module, moduleIndex) => {
      module.id = stableId(subject.id, module.title || `module-${moduleIndex + 1}`);
      module.topics.forEach((topic) => {
        topic.id = stableId(module.id, topic.title);
        topic.subtopics = topic.subtopics.map((subtopic) => ({ ...subtopic, id: stableId(topic.id, subtopic.title) }));
      });
    });
  });
}
