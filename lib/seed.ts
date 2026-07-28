import { CheckpointKey, LearningState, Module, OrbitData, Subject, Topic } from './types';

const today = new Date('2026-07-27');
const checkpointLabels: Record<CheckpointKey, string> = {
  concept: 'Concept understood',
  notes: 'Notes completed',
  code: 'Code or practical completed',
  questions: 'Questions practised',
  revision: 'Revision completed',
};

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const dateAfter = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
const checkpoints = (done: CheckpointKey[] = []) =>
  (Object.keys(checkpointLabels) as CheckpointKey[]).map((key) => ({ key, label: checkpointLabels[key], completed: done.includes(key) }));

function topic(subject: string, title: string, subtopics: string[] = [], state: LearningState = 'not-started'): Topic {
  const completed = state === 'completed' ? (['concept', 'notes', 'code', 'questions', 'revision'] as CheckpointKey[]) : state === 'practising' ? ['concept', 'notes', 'code'] as CheckpointKey[] : state === 'learning' ? ['concept'] as CheckpointKey[] : [];
  return {
    id: `${subject}-${slug(title)}`,
    title,
    description: `Master ${title} with concept clarity, implementation fluency, practice and revision.`,
    difficulty: title.match(/Dijkstra|AVL|B-trees|Regression|Authentication|Security|React|Recursion|Graphs/i) ? 'Hard' : subtopics.length ? 'Core' : 'Foundation',
    estimatedMinutes: Math.max(35, 25 + subtopics.length * 12),
    state,
    confidence: state === 'completed' ? 4 : state === 'practising' ? 3 : state === 'learning' ? 2 : 1,
    checkpoints: checkpoints(completed),
    subtopics: subtopics.map((name) => ({
      id: `${subject}-${slug(title)}-${slug(name)}`,
      title: name,
      state,
      checkpoints: checkpoints(completed),
      confidence: state === 'completed' ? 4 : state === 'practising' ? 3 : 1,
      estimatedMinutes: 25,
    })),
    resources: [],
    codingQuestions: [],
    lastActivity: state !== 'not-started' ? dateAfter(-Math.ceil(Math.random() * 8)) : undefined,
  };
}

const moduleOf = (id: string, title: string, topics: Topic[]): Module => ({ id, title, topics });

function buildSubjects(): Subject[] {
  return [
    {
      id: 'dsa',
      name: 'Data Structures and Algorithms',
      shortName: 'DSA',
      code: 'BCSC0006',
      credits: 4,
      accent: '#A78BFA',
      totalStudyHours: 7,
      assessmentReadiness: 8,
      modules: [
        moduleOf('dsa-m1', 'Module I', [
          topic('dsa', 'Introduction', ['Basic terminology', 'Elementary data organisation', 'Properties of an algorithm', 'Efficiency of an algorithm', 'Time complexity', 'Space complexity', 'Big-O notation', 'Theta notation', 'Omega notation', 'Operations on data structures', 'Abstract Data Types'], 'learning'),
          topic('dsa', 'Linked Lists', ['Singly linked list', 'Singly linked-list implementation', 'Doubly linked list', 'Circular linked list', 'Insertion in linked list', 'Deletion in linked list', 'Traversal of linked list', 'Generalised linked list', 'Polynomial representation using linked list', 'Polynomial addition using linked list']),
          topic('dsa', 'Stacks', ['Stack terminology', 'Push operation', 'Pop operation', 'Array implementation', 'Linked-list implementation', 'Prefix expressions', 'Postfix expressions', 'Postfix evaluation', 'Infix-to-postfix conversion', 'Recursion', 'Principles of recursion', 'Tail recursion', 'Removal of recursion', 'Stack use in recursion', 'Tower of Hanoi']),
          topic('dsa', 'Queues', ['Queue terminology', 'Enqueue or add operation', 'Dequeue or delete operation', 'Array implementation', 'Linked-list implementation', 'Circular queue', 'Deque', 'Priority queue']),
          topic('dsa', 'Trees', ['Tree terminology', 'Array representation', 'Dynamic representation', 'Complete binary tree', 'Algebraic-expression trees', 'Extended binary trees', 'Inorder traversal', 'Preorder traversal', 'Postorder traversal', 'Threaded binary trees', 'Traversal of threaded binary trees']),
        ]),
        moduleOf('dsa-m2', 'Module II', [
          topic('dsa', 'Search Trees', ['Binary Search Tree', 'BST insertion', 'BST deletion', 'AVL tree', 'Introduction to M-way search trees', 'B-trees']),
          topic('dsa', 'Searching', ['Sequential search', 'Binary search']),
          topic('dsa', 'Sorting', ['Bubble sort', 'Selection sort', 'Insertion sort', 'Quick sort', 'Two-way merge sort', 'Heap sort']),
          topic('dsa', 'Graphs', ['Graph terminology', 'Adjacency matrix', 'Adjacency list', 'Depth-first search', 'Breadth-first search', 'Spanning trees', 'Minimum-cost spanning tree', 'Prim algorithm', 'Kruskal algorithm', 'Bellman-Ford algorithm', 'Dijkstra algorithm']),
          topic('dsa', 'Hashing and Indexing', ['Hash functions', 'Collision resolution', 'Primary indices', 'Secondary indices', 'Comparison of indexing and hashing']),
        ]),
      ],
    },
    {
      id: 'dsa-lab',
      name: 'Data Structures and Algorithms Lab',
      shortName: 'DSA Lab',
      code: 'BCSC0805',
      credits: 1,
      accent: '#78C6A3',
      totalStudyHours: 0,
      assessmentReadiness: 0,
      modules: [
        moduleOf('dsa-lab-m1', 'Module I', ['Singly linked-list operations', 'Doubly linked-list insertion', 'Doubly linked-list deletion', 'Doubly linked-list traversal', 'Polynomial addition using linked list', 'Stack operations', 'Infix-to-postfix conversion', 'Postfix evaluation', 'Tower of Hanoi using recursion'].map((name) => topic('dsa-lab', name, ['Java implementation', 'Python implementation']))),
        moduleOf('dsa-lab-m2', 'Module II', ['Linear queue operations', 'Circular queue operations', 'BST insertion', 'BST traversal', 'Dijkstra shortest-path implementation', 'Sequential-search implementation', 'Binary-search implementation', 'Selection-sort implementation', 'Bubble-sort implementation', 'Insertion-sort implementation', 'Merge-sort implementation', 'Quick-sort implementation', 'Heap-sort implementation'].map((name) => topic('dsa-lab', name, ['Java implementation', 'Python implementation']))),
      ],
    },
    {
      id: 'oop-lab',
      name: 'Object-Oriented Programming Lab',
      shortName: 'OOP Lab',
      code: 'BCSC0820',
      credits: 1,
      accent: '#D7AE68',
      totalStudyHours: 4,
      assessmentReadiness: 12,
      modules: [
        moduleOf('oop-m1', 'Module I', ['Classes', 'Constructors', 'Polymorphism', 'Static keyword', 'Inheritance', 'Multithreading using Thread class', 'Multithreading using Runnable interface', 'String handling', 'Generic classes', 'Database connectivity', 'Collections framework'].map((name, i) => topic('oop-lab', name, ['Java implementation', i > 8 ? 'Python equivalent' : 'Practice variation'], i < 1 ? 'completed' : i < 2 ? 'learning' : 'not-started'))),
        moduleOf('oop-m2', 'Module II', ['Database connectivity', 'Retrieving data from database', 'Parameter passing', 'Execute-many method', 'Cursor attributes', 'Stored procedures', 'Stored functions', 'GUI and graphical programming', 'Event handling'].map((name) => topic('oop-lab', name, ['Java checkpoint', 'Python checkpoint']))),
      ],
    },
    {
      id: 'frontend',
      name: 'Introduction to Frontend Engineering',
      shortName: 'Frontend',
      code: 'BCSE0031',
      credits: 3,
      accent: '#F0A3C2',
      totalStudyHours: 38,
      assessmentReadiness: 68,
      modules: [
        moduleOf('fe-m1', 'Module I', [
          topic('frontend', 'HTML', ['Introduction to HTML', 'Elements', 'Semantic HTML', 'Attributes', 'Headings', 'Paragraphs', 'Tables', 'Dropdowns', 'Quotations', 'Lists', 'Blocks', 'Layout', 'Responsive HTML', 'Iframes', 'Head element', 'Entities', 'URI codes', 'Frames', 'Charset', 'Forms', 'HTML security'], 'completed'),
          topic('frontend', 'CSS', ['Introduction', 'Syntax', 'Types of CSS', 'Colours', 'Backgrounds', 'Borders', 'Padding', 'Height and width', 'Gradients', 'Shadows', 'Selectors', 'Transformations', 'Typography', 'Box model', 'Outline', 'Transitions', 'Navigation bars', 'CSS combinators', 'Pseudo-classes', 'Tooltips', 'Images', 'Buttons', 'Animations', 'User-interface properties', 'Box sizing', 'Filters', 'Responsive web design'], 'completed'),
          topic('frontend', 'Bootstrap', ['Introduction', 'Basics', 'Grid', 'Bootstrap CSS', 'Bootstrap JavaScript', 'Themes', 'Alerts', 'Wells', 'Badges', 'Labels', 'Panels', 'Pagination', 'Pager', 'Carousel', 'Progress bar'], 'practising'),
        ]),
        moduleOf('fe-m2', 'Module II', [
          topic('frontend', 'JavaScript', ['Scope', 'Events', 'Strings', 'Math', 'Arrays', 'Booleans', 'Comparisons', 'Conditions', 'Switch', 'Loops', 'Type conversion', 'Errors', 'Debugging', 'Hoisting', 'Strict mode', 'Functions', 'Objects', 'Forms', 'DOM', 'Regular expressions'], 'practising'),
          topic('frontend', 'React', ['Introduction', 'Components', 'JSX', 'Babel', 'Creating React components', 'Props', 'Custom components', 'Forms', 'State', 'React Router', 'React Flux'], 'learning'),
          topic('frontend', 'jQuery', ['Introduction', 'Syntax', 'Selectors', 'Events', 'Effects', 'Traversing', 'AJAX']),
        ]),
      ],
    },
    {
      id: 'backend',
      name: 'Backend Engineering',
      shortName: 'Backend',
      code: 'BCSE0201',
      credits: 3,
      accent: '#8FC7FF',
      totalStudyHours: 16,
      assessmentReadiness: 30,
      modules: [
        moduleOf('be-m1', 'Module I', [
          topic('backend', 'Unix', ['Unix environment', 'Basic Unix commands', 'File and directory navigation'], 'completed'),
          topic('backend', 'Git and GitHub', ['Version-control fundamentals', 'Git repositories', 'Commits', 'Branches', 'Merge', 'Conflict resolution', 'GitHub', 'Collaborative workflows'], 'completed'),
          topic('backend', 'Node.js', ['Introduction to Node.js', 'Node.js use cases', 'HTTP module', 'File-system module', 'Path module', 'Sharing code between files', 'Reading files', 'Writing files', 'Libraries versus frameworks', 'Express introduction', 'First Express application', 'Routing', 'Nodemon', 'Template engines', 'EJS', 'Static files'], 'learning'),
          topic('backend', 'RESTful Routing', ['GET requests', 'POST requests', 'Request-body parsing', 'REST architecture', 'CRUD routes']),
        ]),
        moduleOf('be-m2', 'Module II', [
          topic('backend', 'Databases', ['Persistent data layer', 'SQL databases', 'NoSQL databases', 'CAP theorem', 'MongoDB', 'JSON versus BSON', 'MongoDB insert', 'MongoDB read', 'MongoDB update', 'MongoDB delete', 'Mongoose', 'Schemas', 'Models', 'CRUD using Mongoose']),
          topic('backend', 'Middleware, Sessions and Cookies', ['Middleware fundamentals', 'Custom middleware', 'Route protection', 'Mongoose middleware', 'Cookies', 'Client-side storage', 'Express sessions', 'Server-side session storage']),
          topic('backend', 'Authentication and Authorisation', ['Authentication versus authorisation', 'Cryptographic hashing', 'Bcrypt', 'Persistent login', 'Route-protection middleware', 'Passport.js', 'Role-based authorisation']),
          topic('backend', 'Security and Deployment', ['Mongo injection', 'Cross-site scripting', 'Input sanitisation', 'Mongo session store', 'Helmet', 'Production preparation', 'Cloud database', 'MongoDB Atlas', 'Deployment', 'Monitoring']),
        ]),
      ],
    },
    {
      id: 'backend-lab',
      name: 'Backend Engineering Lab',
      shortName: 'Backend Lab',
      code: 'BCSE0221',
      credits: 1,
      accent: '#9EE6D7',
      totalStudyHours: 7,
      assessmentReadiness: 18,
      modules: [moduleOf('be-lab-m1', 'Lab Sequence', ['Unix architecture', 'ls', 'cd', 'pwd', 'cp', 'rm', 'Creating Git repositories', 'Git commits', 'Branches', 'Merge', 'Conflict resolution', 'Cloning repositories', 'Forking repositories', 'Pull requests', 'GitHub team workflows', 'Node.js installation', 'Event-driven architecture', 'Callbacks', 'Promises', 'Async and await', 'Modular Node.js', 'require', 'module.exports', 'File creation using fs', 'File reading using fs', 'File writing using fs', 'File deletion using fs', 'HTTP server', 'URL routing', 'npm', 'npm scripts', 'Nodemon', 'Postman', 'Express application', 'GET route', 'POST route', 'Request parameters', 'Built-in middleware', 'Custom middleware', 'Dynamic routes', 'RESTful API', 'CRUD using file storage', 'MongoDB integration', 'Mongoose', 'User authentication', 'Sessions', 'JWT', 'Basic backend security'].map((name, i) => topic('backend-lab', name, ['Implement', 'Test', 'Explain'], i < 7 ? 'completed' : i < 12 ? 'learning' : 'not-started')))],
    },
    {
      id: 'probability',
      name: 'Probability and Statistics',
      shortName: 'Stats',
      code: 'BMAS0108',
      credits: 4,
      accent: '#C9B8FF',
      totalStudyHours: 0,
      assessmentReadiness: 0,
      modules: [
        moduleOf('stats-m1', 'Module I', [
          topic('probability', 'Introduction', ['Nominal scale', 'Ordinal scale', 'Interval scale', 'Ratio scale', 'Cross-sectional data', 'Time-series data', 'Grouped-frequency distribution']),
          topic('probability', 'Data Visualisation', ['Importance of data visualisation', 'Graphical representation', 'Histogram', 'Line graph', 'Scatter plot']),
          topic('probability', 'Descriptive Statistics', ['Mean', 'Median', 'Mode', 'Range', 'Quartile deviation', 'Mean deviation', 'Standard deviation']),
          topic('probability', 'Exploratory Data Analysis', ['Data-distribution examination', 'Missing values', 'Outlier detection', 'Box plots', 'Duplicate-data removal', 'Categorical encoding', 'Data standardisation']),
          topic('probability', 'Probability Theory', ['Sample space', 'Events', 'Interpretations of probability', 'Axiomatic definition', 'Discrete random variable', 'Continuous random variable', 'Probability mass function', 'Probability density function', 'Cumulative distribution function']),
          topic('probability', 'Mathematical Expectation', ['Mathematical expectation', 'Moment-generating function', 'Law of large numbers', 'Central Limit Theorem']),
        ]),
        moduleOf('stats-m2', 'Module II', [
          topic('probability', 'Discrete Distributions', ['Binomial distribution', 'Poisson distribution', 'Geometric distribution']),
          topic('probability', 'Continuous Distributions', ['Normal distribution', 'Gamma distribution', 'Exponential distribution']),
          topic('probability', 'Statistical Inference', ['Null hypothesis', 'Alternative hypothesis', 'Level of significance', 'Critical region', 'Acceptance region', 'Type I error', 'Type II error', 'P-value', 'Power of a test']),
          topic('probability', 'Large-Sample Tests', ['Test of mean with known variance', 'Single-proportion test', 'Difference-of-proportions test']),
          topic('probability', 'Small-Sample Tests', ['Single-mean t-test', 'Paired t-test', 'Independent t-test']),
          topic('probability', 'Chi-Square Test', ['Assumptions', 'Test of independence', 'Test of association']),
          topic('probability', 'Correlation', ['Meaning of correlation', 'Types of correlation', 'Simple correlation', 'Karl Pearson coefficient', 'Significance of correlation', 'Correlation heatmap']),
          topic('probability', 'Regression', ['Simple regression', 'Multiple regression', 'Coefficient of determination', 'R-squared']),
        ]),
      ],
    },
  ];
}

export function createInitialData(): OrbitData {
  const subjects = buildSubjects();
  const findTopic = (subjectId: string, topicIdPart: string) => subjects.find((s) => s.id === subjectId)!.modules.flatMap((m) => m.topics).find((t) => t.id.includes(topicIdPart))!;
  const dsaIntro = findTopic('dsa', 'introduction');
  const react = findTopic('frontend', 'react');
  const node = findTopic('backend', 'node-js');
  const statsIntro = findTopic('probability', 'introduction');
  return {
    semester: { id: 'sem-3', title: 'Semester III', program: 'B.Tech CSE AIML', subjects },
    tasks: [
      { id: 'task-1', subjectId: 'backend', topicId: node.id, title: 'Continue Express routing notes', actionType: 'Learn', estimatedMinutes: 45, priority: 'High', completed: false, order: 0, scheduledFor: dateAfter(0) },
      { id: 'task-2', subjectId: 'dsa', topicId: dsaIntro.id, title: 'Practise Big-O and Theta examples', actionType: 'Practise', estimatedMinutes: 35, priority: 'High', completed: false, order: 1, scheduledFor: dateAfter(0) },
      { id: 'task-3', subjectId: 'frontend', topicId: react.id, title: 'Revise React props and forms', actionType: 'Revise', estimatedMinutes: 30, priority: 'Medium', completed: false, order: 2, scheduledFor: dateAfter(0) },
      { id: 'task-4', subjectId: 'probability', topicId: statsIntro.id, title: 'Start measurement scales', actionType: 'Learn', estimatedMinutes: 25, priority: 'Medium', completed: false, order: 3, scheduledFor: dateAfter(0) },
    ],
    revisions: [
      { id: 'rev-1', subjectId: 'frontend', topicId: react.id, round: 1, dueDate: dateAfter(0) },
      { id: 'rev-2', subjectId: 'backend', topicId: node.id, round: 1, dueDate: dateAfter(-1) },
      { id: 'rev-3', subjectId: 'frontend', topicId: findTopic('frontend', 'css').id, round: 2, dueDate: dateAfter(3) },
    ],
    notes: [
      { id: 'note-1', title: 'React state architecture', body: 'Keep component state local until multiple siblings need it. Then lift state or use a small store.', subjectId: 'frontend', topicId: react.id, important: true, confusing: false, updatedAt: dateAfter(-1) },
      { id: 'note-2', title: 'Big-O intuition', body: '`O(n log n)` usually appears when work is split and merged or when each step halves a search space.', subjectId: 'dsa', topicId: dsaIntro.id, important: false, confusing: true, updatedAt: dateAfter(-2) },
    ],
    sessions: [
      { id: 'session-1', subjectId: 'frontend', topicId: react.id, minutes: 50, completedAt: dateAfter(-1) },
      { id: 'session-2', subjectId: 'backend', topicId: node.id, minutes: 40, completedAt: dateAfter(-2) },
      { id: 'session-3', subjectId: 'frontend', minutes: 70, completedAt: dateAfter(-4) },
    ],
    preferences: { theme: 'dark', onboardingComplete: false, workStyle: 'Daily balanced plan', dailyTime: '1 hour', focusModeSubjectId: 'backend' },
  };
}
