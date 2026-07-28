export type LearningState = 'not-started' | 'learning' | 'practising' | 'completed';
export type TopicVisualState = LearningState | 'needs-revision';
export type Difficulty = 'Foundation' | 'Core' | 'Hard' | 'Lab';
export type ActionType = 'Learn' | 'Code' | 'Practise' | 'Revise' | 'Notes' | 'Assignment' | 'Exam preparation';
export type Priority = 'Low' | 'Medium' | 'High';
export type RevisionStatus = 'due' | 'overdue' | 'upcoming' | 'completed';
export type AppPage = 'overview' | 'subjects' | 'today' | 'revision' | 'practice' | 'analytics' | 'notes' | 'settings' | 'history';
export type SetupMethod = 'template' | 'manual' | 'import';

export type CheckpointKey = 'concept' | 'notes' | 'code' | 'questions' | 'revision';

export type ChecklistItem = {
  key: CheckpointKey;
  label: string;
  completed: boolean;
};

export type Subtopic = {
  id: string;
  title: string;
  state: LearningState;
  checkpoints: ChecklistItem[];
  confidence: number;
  important?: boolean;
  confusing?: boolean;
  estimatedMinutes: number;
};

export type Topic = {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  state: LearningState;
  confidence: number;
  checkpoints: ChecklistItem[];
  subtopics: Subtopic[];
  important?: boolean;
  confusing?: boolean;
  resources: string[];
  codingQuestions: string[];
  dueDate?: string;
  lastActivity?: string;
  custom?: boolean;
};

export type Module = {
  id: string;
  title: string;
  topics: Topic[];
  custom?: boolean;
};

export type Subject = {
  id: string;
  name: string;
  shortName: string;
  code: string;
  credits: number;
  accent: string;
  modules: Module[];
  totalStudyHours: number;
  assessmentReadiness: number;
  custom?: boolean;
  archived?: boolean;
  templateSource?: 'btech-cse-aiml' | 'manual' | 'import';
};

export type Semester = {
  id: string;
  title: string;
  program: string;
  subjects: Subject[];
  createdAt: string;
  templateSource?: 'btech-cse-aiml' | 'manual' | 'import';
};

export type StudyTask = {
  id: string;
  subjectId: string;
  topicId?: string;
  title: string;
  actionType: ActionType;
  estimatedMinutes: number;
  actualMinutes?: number;
  priority: Priority;
  completed: boolean;
  order: number;
  scheduledFor: string;
};

export type Revision = {
  id: string;
  subjectId: string;
  topicId: string;
  round: 1 | 2 | 3 | 4;
  dueDate: string;
  completedAt?: string;
  confidenceAfter?: number;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  subjectId?: string;
  moduleId?: string;
  topicId?: string;
  subtopicId?: string;
  important: boolean;
  confusing: boolean;
  resourceUrl?: string;
  updatedAt: string;
};

export type StudySession = {
  id: string;
  taskId?: string;
  subjectId: string;
  topicId?: string;
  minutes: number;
  completedAt: string;
};

export type TopicProgress = {
  topicId: string;
  state: LearningState;
  confidence: number;
  checkpoints: Record<CheckpointKey, boolean>;
  important: boolean;
  confusing: boolean;
  lastActivity?: string;
  completedAt?: string;
};

export type ActivityRecord = {
  id: string;
  timestamp: string;
  action:
    | 'topic_started'
    | 'checkpoint_completed'
    | 'topic_completed'
    | 'confidence_updated'
    | 'revision_completed'
    | 'study_session_completed'
    | 'note_added'
    | 'task_completed';
  subjectId?: string;
  moduleId?: string;
  topicId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
};

export type UserPreferences = {
  theme: 'dark' | 'light';
  onboardingComplete: boolean;
  setupMethod?: SetupMethod;
  workStyle: 'One topic at a time' | 'Daily balanced plan' | 'Exam sprint' | 'Project-focused';
  dailyTime: '30 minutes' | '1 hour' | '2 hours' | 'Flexible';
  focusModeSubjectId?: string;
};

export type OrbitData = {
  schemaVersion: number;
  activeSemesterId?: string;
  semesters?: Semester[];
  semester: Semester;
  topicProgress: Record<string, TopicProgress>;
  tasks: StudyTask[];
  revisions: Revision[];
  notes: Note[];
  sessions: StudySession[];
  activity: ActivityRecord[];
  streak: {
    current: number;
    lastStudyDate?: string;
  };
  preferences: UserPreferences;
};
