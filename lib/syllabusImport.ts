import { CheckpointKey, Difficulty, Module, OrbitData, Semester, Subject, Topic } from './types';

export type PdfPageText = {
  pageNumber: number;
  text: string;
  itemCount: number;
};

export type PdfExtractionQuality = {
  score: number;
  readableCharacterRatio: number;
  controlCharacterRatio: number;
  replacementCharacterRatio: number;
  alphabeticWordCount: number;
  totalCharacters: number;
  likelyCorrupted: boolean;
  likelyScanned: boolean;
  warnings: string[];
};

export type PdfExtractionResult = {
  pages: PdfPageText[];
  fullText: string;
  quality: PdfExtractionQuality;
  extractionMethod: 'pdf-text' | 'ocr';
  durationMs: number;
};

export type ParsedField<T> = {
  value: T;
  confidence: number;
  sourcePage?: number;
  sourceText?: string;
};

export type SyllabusStats = {
  subjectCount: number;
  moduleCount: number;
  topicCount: number;
  subtopicCount: number;
  estimatedStudyHours: number;
  weeklyPace: string;
  difficultyRanking: { subjectId: string; subject: string; score: number; label: string }[];
};

export type ExtractionDiagnostics = {
  pageCount: number;
  itemsPerPage: number[];
  readableCharactersPerPage: number[];
  qualityScore: number;
  likelyScanned: boolean;
  likelyCorrupted: boolean;
  extractionDurationMs: number;
  parserConfidence: number;
};

export type ExtractedSyllabus = {
  semester: Semester;
  stats: SyllabusStats;
  warnings: string[];
  provider: 'rule-based-pdf' | 'rule-based-text' | 'llm-ready';
  rawText: string;
  pdfExtraction?: PdfExtractionResult;
  parserConfidence: number;
  diagnostics?: ExtractionDiagnostics;
};

export type SyllabusParserProvider = {
  id: ExtractedSyllabus['provider'];
  extract: (input: File | string) => Promise<ExtractedSyllabus>;
};

export type OcrProvider = {
  extractTextFromPdf: (file: File) => Promise<PdfExtractionResult>;
};

export class PdfExtractionError extends Error {
  result?: PdfExtractionResult;

  constructor(message: string, result?: PdfExtractionResult) {
    super(message);
    this.name = 'PdfExtractionError';
    this.result = result;
  }
}

export const mockedOcrProvider: OcrProvider = {
  async extractTextFromPdf() {
    throw new PdfExtractionError('OCR is not configured yet. Paste syllabus text or connect an OCR provider.');
  },
};

const accents = ['#A78BFA', '#78C6A3', '#D7AE68', '#8FC7FF', '#E08282', '#B9A7FF'];
const checkpointKeys: CheckpointKey[] = ['concept', 'notes', 'code', 'questions', 'revision'];
const checklist = () => checkpointKeys.map((key) => ({ key, label: checkpointLabel(key), completed: false }));
const noiseLinePatterns = [
  /^adobe$/i,
  /^identity(?:-h)?$/i,
  /^cidfont/i,
  /^fontdescriptor$/i,
  /^tounicode$/i,
  /^basefont$/i,
  /^encoding$/i,
  /^\d+\s+\d+\s+obj$/i,
  /^endobj$/i,
  /^stream$/i,
  /^endstream$/i,
  /^wm\d+$/i,
];

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
    const pdfExtraction = await extractPdfText(input);
    if (pdfExtraction.quality.likelyScanned) {
      throw new PdfExtractionError('This PDF appears to be scanned. OCR is required to read it.', pdfExtraction);
    }
    if (pdfExtraction.quality.likelyCorrupted) {
      throw new PdfExtractionError('We could not reliably extract readable text from this PDF. Its text may use unsupported font encoding or the file may be image-based.', pdfExtraction);
    }
    return buildExtraction(pdfExtraction.fullText, 'rule-based-pdf', pdfExtraction.quality.warnings, pdfExtraction);
  },
};

const ruleBasedTextProvider: SyllabusParserProvider = {
  id: 'rule-based-text',
  async extract(input) {
    return buildExtraction(typeof input === 'string' ? input : await input.text(), 'rule-based-text');
  },
};

export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  if (file.type && file.type !== 'application/pdf') {
    throw new PdfExtractionError('Choose a PDF file.');
  }
  const started = performance.now();
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let documentProxy;
  try {
    documentProxy = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false }).promise;
  } catch (error) {
    throw new PdfExtractionError(error instanceof Error && /password/i.test(error.message) ? 'This PDF appears to be password-protected or unsupported.' : 'This PDF could not be opened. It may be damaged or unsupported.');
  }

  const pages: PdfPageText[] = [];
  for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
    const page = await documentProxy.getPage(pageNumber);
    const content = await page.getTextContent({ includeMarkedContent: false });
    const textItems = content.items.flatMap((item) => {
      if (!isPdfTextItem(item)) return [];
      const textItem = {
        str: normalizePdfItemText(item.str),
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: Math.abs(item.transform[3]) || item.height || 10,
      };
      return textItem.str.trim().length > 0 ? [textItem] : [];
    });
    pages.push({ pageNumber, text: reconstructPageLines(textItems), itemCount: textItems.length });
  }
  const fullText = normalizeExtractedPdfText(pages.map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`).join('\n\n'));
  const quality = assessExtractedTextQuality(fullText, pages);
  return { pages, fullText, quality, extractionMethod: 'pdf-text', durationMs: Math.round(performance.now() - started) };
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height?: number;
};

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item && typeof (item as { str?: unknown }).str === 'string' && Array.isArray((item as { transform?: unknown }).transform);
}

function normalizePdfItemText(value: string) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function reconstructPageLines(items: { str: string; x: number; y: number; width: number; height: number }[]) {
  const sorted = [...items].sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
  const lines: { y: number; items: typeof items }[] = [];
  sorted.forEach((item) => {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(3, item.height * 0.45));
    if (line) {
      line.items.push(item);
      line.y = (line.y + item.y) / 2;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  });
  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const lineItems = line.items.sort((a, b) => a.x - b.x);
      return lineItems.reduce((text, item, index) => {
        if (index === 0) return item.str;
        const previous = lineItems[index - 1];
        const gap = item.x - (previous.x + previous.width);
        return `${text}${gap > 2 ? ' ' : ''}${item.str}`;
      }, '');
    })
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function normalizeExtractedPdfText(text: string) {
  const normalized = text
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\u0000/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/([.·•])\1{3,}/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
  const lines = normalized.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  const withoutNoise = lines.filter((line) => !isPdfMetadataNoiseLine(line));
  return removeRepeatedHeadersAndFooters(withoutNoise).join('\n').trim();
}

function isPdfMetadataNoiseLine(line: string) {
  const compact = line.replace(/[\\/<>()\[\]{}:]+/g, '').trim();
  return noiseLinePatterns.some((pattern) => pattern.test(compact));
}

function removeRepeatedHeadersAndFooters(lines: string[]) {
  const counts = new Map<string, number>();
  lines.forEach((line) => {
    if (line.length <= 90) counts.set(line, (counts.get(line) ?? 0) + 1);
  });
  return lines.filter((line) => (counts.get(line) ?? 0) < 4 || /course|subject|module|unit|credit|semester/i.test(line));
}

export function assessExtractedTextQuality(text: string, pages: PdfPageText[] = []): PdfExtractionQuality {
  const totalCharacters = text.length;
  const printableCharacters = [...text].filter((char) => char === '\n' || char === '\t' || /[\p{L}\p{N}\p{P}\p{S}\p{Zs}]/u.test(char)).length;
  const controlCharacters = [...text].filter((char) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(char)).length;
  const replacementCharacters = [...text].filter((char) => char === '\uFFFD').length;
  const alphabeticWords = text.match(/\b[\p{L}]{3,}\b/gu) ?? [];
  const naturalLines = text.split('\n').filter((line) => /\b[\p{L}]{3,}\b/u.test(line) && line.length > 8);
  const metadataLines = text.split('\n').filter(isPdfMetadataNoiseLine).length;
  const singleCharacterLines = text.split('\n').filter((line) => /^[\p{L}\p{N}]$/u.test(line.trim())).length;
  const averageWordLength = alphabeticWords.length ? alphabeticWords.join('').length / alphabeticWords.length : 0;
  const readableCharacterRatio = totalCharacters ? printableCharacters / totalCharacters : 0;
  const controlCharacterRatio = totalCharacters ? controlCharacters / totalCharacters : 0;
  const replacementCharacterRatio = totalCharacters ? replacementCharacters / totalCharacters : 0;
  const pageItemCount = pages.reduce((sum, page) => sum + page.itemCount, 0);
  const likelyScanned = pages.length > 0 && (pageItemCount <= Math.max(2, pages.length * 2) || totalCharacters < 80);
  const likelyMetadataOnly = metadataLines > 4 && metadataLines >= naturalLines.length;
  const likelyBinaryLike = readableCharacterRatio < 0.7 || controlCharacterRatio > 0.01 || replacementCharacterRatio > 0.01 || averageWordLength > 18 || singleCharacterLines > naturalLines.length * 2;
  const likelyCorrupted = !likelyScanned && (likelyBinaryLike || likelyMetadataOnly || naturalLines.length < 3 || alphabeticWords.length < 12);
  const warnings: string[] = [];
  if (likelyScanned) warnings.push('This PDF appears to be scanned. OCR is required to read it.');
  if (likelyCorrupted) warnings.push('Readable text extraction quality is too low. The PDF may use unsupported embedded font encoding.');
  if (metadataLines > 0) warnings.push('PDF metadata/font noise was detected and filtered before parsing.');
  const score = Math.max(0, Math.min(100, Math.round(readableCharacterRatio * 60 + Math.min(alphabeticWords.length / 120, 1) * 25 + Math.min(naturalLines.length / 20, 1) * 15 - controlCharacterRatio * 100 - replacementCharacterRatio * 100)));
  return { score, readableCharacterRatio, controlCharacterRatio, replacementCharacterRatio, alphabeticWordCount: alphabeticWords.length, totalCharacters, likelyCorrupted, likelyScanned, warnings };
}

function buildExtraction(raw: string, provider: ExtractedSyllabus['provider'], warnings: string[] = [], pdfExtraction?: PdfExtractionResult): ExtractedSyllabus {
  const text = normalizeExtractedPdfText(raw);
  const semesterTitle = detectSemesterTitle(text);
  const subjectBlocks = detectSubjectBlocks(text);
  const subjects = subjectBlocks.map(blockToSubject).filter((subject) => subject.modules.some((module) => module.topics.length > 0));
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
  const parserConfidence = calculateParserConfidence(text, semester);
  return {
    semester,
    stats,
    provider,
    rawText: text,
    pdfExtraction,
    parserConfidence,
    diagnostics: pdfExtraction && process.env.NODE_ENV !== 'production' ? {
      pageCount: pdfExtraction.pages.length,
      itemsPerPage: pdfExtraction.pages.map((page) => page.itemCount),
      readableCharactersPerPage: pdfExtraction.pages.map((page) => page.text.replace(/\s/g, '').length),
      qualityScore: pdfExtraction.quality.score,
      likelyScanned: pdfExtraction.quality.likelyScanned,
      likelyCorrupted: pdfExtraction.quality.likelyCorrupted,
      extractionDurationMs: pdfExtraction.durationMs,
      parserConfidence,
    } : undefined,
    warnings: [
      ...warnings,
      subjects.length ? 'Rule-based extraction can handle common university formats, but review the preview before importing.' : 'No high-confidence subjects were detected. Paste the syllabus text or try another PDF.',
      provider === 'rule-based-pdf' ? 'LLM enhancement provider is ready to plug in later without changing the review UI.' : 'Plain-text extraction used the same review pipeline as PDF imports.',
    ],
  };
}

function calculateParserConfidence(text: string, semester: Semester) {
  const hasCourseCodes = semester.subjects.filter((subject) => subject.code && !subject.code.startsWith('SUB-')).length;
  const topicCount = semester.subjects.flatMap((subject) => subject.modules.flatMap((module) => module.topics)).length;
  const moduleCount = semester.subjects.flatMap((subject) => subject.modules).length;
  const structureSignals = [/course\s+code/i, /subject\s+name/i, /\b[A-Z]{2,6}\s*[- ]?\d{2,4}\b/, /module\s+(?:i|ii|iii|iv|\d+)/i, /unit\s+(?:i|ii|iii|iv|\d+)/i].filter((pattern) => pattern.test(text)).length;
  return Math.min(100, Math.round(structureSignals * 14 + hasCourseCodes * 10 + Math.min(topicCount, 20) * 2 + Math.min(moduleCount, 10) * 2));
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
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    return { heading: start.line, body: lines.slice(start.index + 1, end).join('\n'), index: position };
  });
}

function isSubjectHeading(line: string) {
  if (line.length > 180 || isPdfMetadataNoiseLine(line)) return false;
  const hasExplicitLabel = /(?:course|subject)\s*(?:code|title|name)?/i.test(line);
  const hasCourseCode = /\b[A-Z]{2,6}\s*[- ]?\d{2,4}\b/.test(line);
  const hasSubjectWords = /\b(data|algorithm|machine|math|database|network|software|computer|engineering|programming|statistics|probability|operating|web|security|physics|chemistry|english|management)\b/i.test(line);
  return (hasExplicitLabel && (hasCourseCode || hasSubjectWords)) || (hasCourseCode && (hasSubjectWords || /credits?|L-T-P|teaching\s+hours/i.test(line)));
}

function blockToSubject({ heading, body, index }: { heading: string; body: string; index: number }): Subject {
  const combined = `${heading}\n${body}`;
  const code = combined.match(/\b[A-Z]{2,6}\s*[- ]?\d{2,4}\b/)?.[0]?.replace(/\s+/, '-') ?? `SUB-${index + 1}`;
  const creditMatch = combined.match(/(?:credits?|cr)\s*[:=-]?\s*(\d+)/i) ?? combined.match(/\b(\d)\s*credits?\b/i);
  const credits = creditMatch ? Number(creditMatch[1]) : undefined;
  const name = cleanSubjectName(heading, code, index);
  const modules = detectModules(body || heading).map((module, moduleIndex) => blockToModule(module, moduleIndex)).filter((module) => module.topics.length > 0);
  return {
    id: stableId('subject', code, name),
    name,
    shortName: name.slice(0, 12),
    code,
    credits,
    accent: accents[index % accents.length],
    modules,
    totalStudyHours: 0,
    assessmentReadiness: 0,
    custom: true,
    templateSource: 'import',
  };
}

function cleanSubjectName(heading: string, code: string, index: number) {
  const labelled = heading.match(/(?:course|subject)\s*(?:name|title)\s*[:=-]\s*([^|,\n]+)/i)?.[1];
  const cleaned = (labelled ?? heading)
    .replace(code, '')
    .replace(/(?:course|subject)\s*(?:code|title|name)?\s*[:=-]?/gi, '')
    .replace(/credits?.*/i, '')
    .replace(/\bL-T-P-J?\b.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned && cleaned.length > 2 && !isPdfMetadataNoiseLine(cleaned) ? cleaned : `Subject ${index + 1}`;
}

function detectModules(text: string) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const starts = lines.map((line, index) => ({ line, index })).filter(({ line }) => /^(module|unit)\s*[-:]?\s*([ivxlcdm]+|\d+)/i.test(line));
  if (!starts.length) return [];
  return starts.map((start, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    const [moduleTitle, inlineBody = ''] = start.line.split(/\s*:\s*/, 2);
    return { title: moduleTitle.replace(/\s+/g, ' ').slice(0, 90), body: [inlineBody, ...lines.slice(start.index + 1, end)].filter(Boolean).join('\n') };
  });
}

function blockToModule({ title, body }: { title: string; body: string }, moduleIndex: number): Module {
  return {
    id: stableId('module', title || `Unit ${moduleIndex + 1}`),
    title: title || `Unit ${moduleIndex + 1}`,
    custom: true,
    topics: detectTopics(body).map((topic, index) => blockToTopic(topic, index)),
  };
}

function detectTopics(text: string) {
  const lines = text
    .split(/\n|;|•|\u2022/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 2 && !isPdfMetadataNoiseLine(line) && !/^(objective|prerequisite|outcomes?|text\s*books?|references?|teaching\s+hours|credits?|l-t-p)/i.test(line));
  const joined = lines.length > 1 ? lines : text.split(/,(?=\s*[\p{L}A-Z])/u).map((item) => item.trim()).filter(Boolean);
  return joined.filter((line) => /\p{L}/u.test(line)).slice(0, 30);
}

function blockToTopic(line: string, index: number): Topic {
  const pieces = line.split(/\s*[:>]\s*/).filter(Boolean);
  const title = (pieces[0] || `Topic ${index + 1}`).slice(0, 120);
  const subtopics = pieces.slice(1).join(' ').split(/,|\band\b/i).map((item) => item.trim()).filter((item) => item.length > 2 && /\p{L}/u.test(item)).slice(0, 8);
  return {
    id: stableId('topic', title),
    title,
    description: line,
    difficulty: detectDifficulty(line),
    estimatedMinutes: estimateMinutes(line, subtopics.length),
    state: 'not-started',
    confidence: 1,
    checkpoints: checklist(),
    subtopics: subtopics.map((subtopic) => ({
      id: stableId('subtopic', title, subtopic),
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
