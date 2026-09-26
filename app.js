const STORAGE_KEY = 'orbit-html-workspace-v1';
const today = new Date().toISOString().slice(0, 10);
const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const starterData = {
  profile: { term: 'Semester 4', program: 'B.Tech CSE · AIML', theme: 'light' },
  subjects: [
    { id: 'math', name: 'Discrete Mathematics', code: 'CSE204', topics: [{ name: 'Relations and functions', state: 'learning' }, { name: 'Graph theory', state: 'not-started' }, { name: 'Combinatorics', state: 'not-started' }, { name: 'Propositional logic', state: 'completed' }] },
    { id: 'ml', name: 'Machine Learning', code: 'AIML202', topics: [{ name: 'Linear regression', state: 'learning' }, { name: 'Decision trees', state: 'not-started' }, { name: 'Model evaluation', state: 'not-started' }, { name: 'Feature engineering', state: 'completed' }] },
    { id: 'dbms', name: 'Database Systems', code: 'CSE208', topics: [{ name: 'Relational algebra', state: 'learning' }, { name: 'Normalization', state: 'not-started' }, { name: 'SQL joins', state: 'not-started' }, { name: 'ER modeling', state: 'completed' }] },
    { id: 'web', name: 'Web Technologies', code: 'CSE212', topics: [{ name: 'HTML foundations', state: 'completed' }, { name: 'CSS layout', state: 'learning' }, { name: 'JavaScript DOM', state: 'not-started' }, { name: 'HTTP basics', state: 'not-started' }] },
  ],
  tasks: [
    { id: 'task-1', title: 'Review linear regression notes', subjectId: 'ml', minutes: 35, date: today, done: false },
    { id: 'task-2', title: 'Solve graph theory practice set', subjectId: 'math', minutes: 45, date: today, done: false },
    { id: 'task-3', title: 'Sketch a normalized schema', subjectId: 'dbms', minutes: 30, date: today, done: false },
  ],
  notes: [
    { id: 'note-1', title: 'Gradient descent', body: 'Update the parameters in the direction that reduces the loss. A smaller learning rate usually gives steadier convergence, though it takes longer.', subjectId: 'ml', updated: today },
    { id: 'note-2', title: 'Normal forms', body: '1NF: atomic values. 2NF: no partial dependency on a candidate key. 3NF: no transitive dependency of non-key attributes.', subjectId: 'dbms', updated: today },
  ],
  activity: [1, 2, 0, 3, 1, 2, 0],
  activeView: 'overview',
};

let state = loadState();
let timerSeconds = 25 * 60;
let timerHandle = null;
let toastHandle = null;
let searchTerm = '';

const content = document.querySelector('#app-content');
const dialogTask = document.querySelector('#task-dialog');
const dialogNote = document.querySelector('#note-dialog');
const focusDialog = document.querySelector('#focus-dialog');

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.subjects) && Array.isArray(saved.tasks)) return { ...structuredClone(starterData), ...saved };
  } catch { /* Use the starter workspace when saved data is unavailable. */ }
  return structuredClone(starterData);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function subjectFor(id) {
  return state.subjects.find((subject) => subject.id === id);
}

function subjectProgress(subject) {
  if (!subject.topics.length) return 0;
  return Math.round(subject.topics.filter((topic) => topic.state === 'completed').length / subject.topics.length * 100);
}

function overallProgress() {
  const topics = state.subjects.flatMap((subject) => subject.topics);
  return topics.length ? Math.round(topics.filter((topic) => topic.state === 'completed').length / topics.length * 100) : 0;
}

function completedTopics() {
  return state.subjects.flatMap((subject) => subject.topics).filter((topic) => topic.state === 'completed').length;
}

function pageTitle(view) {
  return ({ overview: 'Overview', subjects: 'Subjects', today: 'Today', revision: 'Revision', analytics: 'Analytics', notes: 'Notes', settings: 'Settings' })[view] || 'Overview';
}

function setView(view) {
  state.activeView = view;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function taskRows(tasks) {
  if (!tasks.length) return '<div class="empty-state">No study tasks here yet. Add one when you are ready.</div>';
  return `<div class="task-list">${tasks.map((task) => `<div class="task-row ${task.done ? 'is-complete' : ''}">
    <button class="task-check ${task.done ? 'is-done' : ''}" data-action="toggle-task" data-id="${escapeHtml(task.id)}" aria-label="${task.done ? 'Mark incomplete' : 'Complete'} ${escapeHtml(task.title)}">✓</button>
    <div><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta">${escapeHtml(subjectFor(task.subjectId)?.name || 'Independent study')}</div></div>
    <span class="task-time">${Number(task.minutes) || 0} min</span>
  </div>`).join('')}</div>`;
}

function subjectRows() {
  if (!state.subjects.length) return '<div class="empty-state">Add a subject to start tracking your semester.</div>';
  return `<div class="subject-list">${state.subjects.slice(0, 5).map((subject) => `<div class="subject-progress-row"><div><strong>${escapeHtml(subject.name)}</strong><small>${subject.topics.filter((topic) => topic.state === 'completed').length} of ${subject.topics.length} topics complete</small></div><span>${subjectProgress(subject)}%</span><div class="mini-track"><span style="width:${subjectProgress(subject)}%"></span></div></div>`).join('')}</div>`;
}

function overviewView() {
  const openTasks = state.tasks.filter((task) => task.date === today && !task.done);
  const allTopics = state.subjects.reduce((total, subject) => total + subject.topics.length, 0);
  const hours = Math.round(state.activity.reduce((total, sessions) => total + sessions, 0) * 2.5) / 10;
  return `<div class="page-heading"><div><p class="eyebrow">YOUR SEMESTER, IN VIEW</p><h1>Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, Kashvi.</h1><p>A clear next step is enough for today. Here is where things stand.</p></div><button class="button button-quiet" data-action="open-focus">◷ &nbsp;Focus session</button></div>
    <div class="dashboard-grid">
      <section class="panel welcome-panel"><div class="welcome-copy"><p class="eyebrow">${escapeHtml(state.profile.term).toUpperCase()} · ${escapeHtml(state.profile.program).toUpperCase()}</p><h2>Make steady progress, one topic at a time.</h2><p>Your plan is ready. Pick one small task and get moving.</p><button class="button" data-view="today">Open today's plan <span>↗</span></button></div><div class="orbit-mark" aria-hidden="true"><span class="orbit-core"></span></div></section>
      <section class="panel stat-panel"><div><div class="stat-panel-head"><span>Study momentum</span><span>↗</span></div><div class="stat-number">${hours}<small> hrs</small></div><div class="stat-foot"><strong>${openTasks.length} tasks</strong><span>planned for today</span></div></div><div class="stat-spark" aria-label="Study activity over the last seven days">${state.activity.slice(-7).map((hoursValue) => `<span style="height:${Math.max(13, Math.min(100, hoursValue * 23))}%"></span>`).join('')}</div></section>
    </div>
    <div class="section-row"><div><h2>Semester at a glance</h2><p>Small steps add up. Keep the rhythm easy to repeat.</p></div><button class="text-button" data-view="analytics">View analytics ↗</button></div>
    <div class="metric-grid"><article class="panel metric-card"><div class="metric-card-head"><span>Topics complete</span><span class="metric-mark">◉</span></div><strong>${completedTopics()} <small>of ${allTopics}</small></strong></article><article class="panel metric-card"><div class="metric-card-head"><span>Daily plan</span><span class="metric-mark">☑</span></div><strong>${state.tasks.filter((task) => task.date === today && task.done).length}<small> / ${state.tasks.filter((task) => task.date === today).length} done</small></strong></article><article class="panel metric-card"><div class="metric-card-head"><span>Subjects</span><span class="metric-mark">▤</span></div><strong>${state.subjects.length}<small> in this semester</small></strong></article></div>
    <div class="lower-grid"><section class="panel panel-body"><div class="panel-heading"><div><h3>Today's plan</h3><p>${escapeHtml(dateLabel.format(new Date()))}</p></div><button class="text-button" data-view="today">All tasks ↗</button></div>${taskRows(state.tasks.filter((task) => task.date === today).slice(0, 4))}</section><section class="panel panel-body"><div class="panel-heading"><div><h3>Subject progress</h3><p>Completed topics by subject</p></div><button class="text-button" data-view="subjects">Browse ↗</button></div>${subjectRows()}</section></div>`;
}

function subjectsView() {
  const subjects = state.subjects.filter((subject) => `${subject.name} ${subject.code} ${subject.topics.map((topic) => topic.name).join(' ')}`.toLowerCase().includes(searchTerm));
  return `<div class="page-heading"><div><p class="eyebrow">YOUR LEARNING MAP</p><h1>Subjects</h1><p>Track topic progress across ${state.subjects.length} subjects.</p></div><button class="button button-primary" data-action="add-subject">＋ &nbsp;Add subject</button></div>
    <div class="subject-cards">${subjects.map((subject) => `<article class="panel subject-card"><div class="subject-card-top"><div><span class="subject-code">${escapeHtml(subject.code || 'CUSTOM')}</span><h3>${escapeHtml(subject.name)}</h3><p>${subject.topics.length} topics · ${subject.topics.filter((topic) => topic.state === 'completed').length} completed</p></div><span class="subject-percent">${subjectProgress(subject)}%</span></div><div class="mini-track"><span style="width:${subjectProgress(subject)}%"></span></div><div class="topic-list">${subject.topics.map((topic, index) => `<div class="topic-row"><span>${escapeHtml(topic.name)}</span><select class="state-select" data-action="topic-state" data-subject="${escapeHtml(subject.id)}" data-topic="${index}" aria-label="Progress for ${escapeHtml(topic.name)}"><option value="not-started" ${topic.state === 'not-started' ? 'selected' : ''}>Not started</option><option value="learning" ${topic.state === 'learning' ? 'selected' : ''}>Learning</option><option value="practising" ${topic.state === 'practising' ? 'selected' : ''}>Practising</option><option value="completed" ${topic.state === 'completed' ? 'selected' : ''}>Completed</option></select></div>`).join('')}</div><button class="text-button" data-action="add-topic" data-subject="${escapeHtml(subject.id)}">＋ Add a topic</button></article>`).join('')}
    <button class="subject-add" data-action="add-subject">＋ &nbsp; Create another subject</button></div>`;
}

function todayView() {
  const tasks = state.tasks.filter((task) => task.date === today && `${task.title} ${subjectFor(task.subjectId)?.name || ''}`.toLowerCase().includes(searchTerm));
  const done = tasks.filter((task) => task.done).length;
  const totalMinutes = tasks.reduce((sum, task) => sum + Number(task.minutes || 0), 0);
  return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(dateLabel.format(new Date()).toUpperCase())}</p><h1>Today's plan</h1><p>Make space for focused work and leave room to reset.</p></div><button class="button button-primary" data-action="open-task">＋ &nbsp;Add task</button></div>
    <div class="planner-layout"><section class="panel planner-panel"><div class="panel-heading"><div><h3>Study tasks</h3><p>${done} completed · ${tasks.length - done} remaining</p></div><button class="button button-quiet button-small" data-action="open-focus">◷ &nbsp;Focus</button></div>${taskRows(tasks)}</section><aside class="panel planner-panel"><div class="panel-heading"><div><h3>Today's shape</h3><p>A little structure, no pressure.</p></div></div><div class="planner-summary"><div><span>Planned</span><strong>${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m</strong></div><div><span>Complete</span><strong>${done}</strong></div><div><span>Left</span><strong>${tasks.length - done}</strong></div></div><div class="section-row"><div><h2>Quick note</h2><p>Capture a thought before it slips away.</p></div></div><button class="button button-quiet" data-action="open-note">＋ &nbsp;Write a note</button></aside></div>`;
}

function revisionView() {
  const topics = state.subjects.flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subjectName: subject.name }))).filter((topic) => topic.state === 'learning' || topic.state === 'practising');
  return `<div class="page-heading"><div><p class="eyebrow">SPACED PRACTICE</p><h1>Revision</h1><p>Revisit active topics to make what you know easier to recall.</p></div></div>
    <div class="planner-layout"><section class="panel planner-panel"><div class="panel-heading"><div><h3>Topics to revisit</h3><p>${topics.length} topics in progress</p></div></div>${topics.length ? topics.map((topic) => `<div class="revision-item"><div><strong>${escapeHtml(topic.name)}</strong><small>${escapeHtml(topic.subjectName)}</small></div><span class="revision-badge">In progress</span></div>`).join('') : '<div class="empty-state">Nothing due right now. Mark a topic as learning to add it here.</div>'}</section><aside class="panel planner-panel"><p class="eyebrow">A SMALL REMINDER</p><h3>Retrieval beats rereading.</h3><p class="focus-caption">Try explaining the idea from memory, then check your notes. Short reviews spread over time help concepts stick.</p><button class="button button-primary" data-view="subjects">Choose a topic <span>↗</span></button></aside></div>`;
}

function analyticsView() {
  const topics = state.subjects.flatMap((subject) => subject.topics);
  const active = topics.filter((topic) => topic.state === 'learning' || topic.state === 'practising').length;
  const weekly = state.activity.slice(-7);
  return `<div class="page-heading"><div><p class="eyebrow">THE LONG VIEW</p><h1>Analytics</h1><p>Notice the patterns. Adjust the plan when it helps.</p></div></div>
    <div class="metric-grid"><article class="panel metric-card"><div class="metric-card-head"><span>Semester progress</span><span class="metric-mark">◉</span></div><strong>${overallProgress()}<small>% of topics</small></strong></article><article class="panel metric-card"><div class="metric-card-head"><span>In progress</span><span class="metric-mark">↗</span></div><strong>${active}<small> topics</small></strong></article><article class="panel metric-card"><div class="metric-card-head"><span>Study sessions</span><span class="metric-mark">◷</span></div><strong>${state.activity.reduce((sum, value) => sum + value, 0)}<small> this week</small></strong></article></div>
    <div class="lower-grid"><section class="panel panel-body"><div class="panel-heading"><div><h3>Weekly activity</h3><p><span class="legend-dot"></span>Focus sessions · last 7 days</p></div><span class="task-time">THIS WEEK</span></div><div class="activity-chart">${weekly.map((value, index) => `<div class="activity-day"><span style="height:${Math.max(3, value * 24)}%" title="${value} sessions"></span>${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(Date.now() - (6 - index) * 86400000))}</div>`).join('')}</div></section><section class="panel panel-body"><div class="panel-heading"><div><h3>Progress by subject</h3><p>Topics marked complete</p></div></div>${subjectRows()}</section></div>`;
}

function notesView() {
  const notes = state.notes.filter((note) => `${note.title} ${note.body} ${subjectFor(note.subjectId)?.name || ''}`.toLowerCase().includes(searchTerm));
  return `<div class="page-heading"><div><p class="eyebrow">YOUR SECOND BRAIN</p><h1>Notes</h1><p>Keep useful explanations and questions close to the topics they belong to.</p></div><button class="button button-primary" data-action="open-note">＋ &nbsp;New note</button></div>
    <div class="notes-list">${notes.map((note) => `<article class="panel note-card"><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><footer><span>${escapeHtml(subjectFor(note.subjectId)?.name || 'General')}</span><span>${escapeHtml(note.updated || 'Recently')}</span></footer></article>`).join('')}${notes.length ? '' : '<div class="empty-state">No notes match your search. Write a quick note to start a collection.</div>'}</div>`;
}

function settingsView() {
  const links = [['login.html', 'Login page'], ['registeration.html', 'Registration form'], ['marksheet.html', 'Student marksheet'], ['restaurent.html', 'Restaurant menu'], ['resume.html', 'Resume']];
  return `<div class="page-heading"><div><p class="eyebrow">PREFERENCES & DATA</p><h1>Settings</h1><p>Control your local workspace and manage your semester data.</p></div></div>
    <div class="settings-grid"><section class="panel settings-section"><h2>Workspace</h2><p>Your data stays in this browser unless you export it.</p><div class="setting-row"><div><strong>Appearance</strong><small>Choose a light or dark workspace.</small></div><button class="button button-quiet button-small" data-action="toggle-theme">${state.profile.theme === 'dark' ? 'Dark mode' : 'Light mode'} · Switch</button></div><div class="setting-row"><div><strong>Export workspace</strong><small>Download subjects, progress, tasks, and notes as JSON.</small></div><button class="button button-quiet button-small" data-action="export-data">Download JSON</button></div><div class="setting-row"><div><strong>Import workspace</strong><small>Restore a previously exported ORBIT JSON file.</small></div><label class="button button-quiet button-small" for="import-file">Choose file</label><input id="import-file" type="file" accept="application/json,.json" hidden></div><div class="setting-row"><div><strong class="danger-text">Reset workspace</strong><small>Clear local progress and restore the starter semester.</small></div><button class="button button-quiet button-small danger-text" data-action="reset-data">Reset data</button></div></section>
    <section class="panel settings-section"><h2>Assignment work</h2><p>HTML practice pages from the assignment collection.</p><div class="assignment-list">${links.map(([href, label]) => `<a class="assignment-link" href="assignent%20-%202/${href}"><span>${label}</span><span>↗</span></a>`).join('')}</div></section></div>`;
}

function render() {
  const view = state.activeView || 'overview';
  const views = { overview: overviewView, subjects: subjectsView, today: todayView, revision: revisionView, analytics: analyticsView, notes: notesView, settings: settingsView };
  content.innerHTML = (views[view] || overviewView)();
  document.querySelector('#page-label').textContent = pageTitle(view);
  document.querySelector('#top-program').textContent = state.profile.program;
  document.querySelector('#sidebar-term').textContent = state.profile.term;
  document.querySelector('#sidebar-program').textContent = state.profile.program;
  document.querySelector('#sidebar-progress').textContent = `${overallProgress()}%`;
  document.querySelector('#sidebar-progress-bar').style.width = `${overallProgress()}%`;
  document.querySelector('#today-count').textContent = state.tasks.filter((task) => task.date === today && !task.done).length;
  document.documentElement.dataset.theme = state.profile.theme || 'light';
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
}

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function populateSubjectSelects() {
  const options = state.subjects.map((subject) => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join('');
  document.querySelector('#task-subject').innerHTML = options;
  document.querySelector('#note-subject').innerHTML = `<option value="">General</option>${options}`;
}

function openTaskDialog() {
  populateSubjectSelects();
  document.querySelector('#task-form [name="date"]').value = today;
  dialogTask.showModal();
}

function openNoteDialog() {
  populateSubjectSelects();
  dialogNote.showModal();
}

function addSubject() {
  const name = window.prompt('Subject name');
  if (!name?.trim()) return;
  const code = window.prompt('Subject code (optional)') || 'CUSTOM';
  state.subjects.push({ id: `subject-${Date.now()}`, name: name.trim(), code: code.trim(), topics: [] });
  saveState(); render(); notify('Subject added.');
}

function addTopic(subjectId) {
  const subject = subjectFor(subjectId);
  if (!subject) return;
  const name = window.prompt(`Add a topic to ${subject.name}`);
  if (!name?.trim()) return;
  subject.topics.push({ name: name.trim(), state: 'not-started' });
  saveState(); render(); notify('Topic added.');
}

function downloadData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orbit-workspace-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
  notify('Workspace export downloaded.');
}

function openFocus() {
  focusDialog.showModal();
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (button) setView(button.dataset.view);
});
content.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, subject } = button.dataset;
  if (action === 'toggle-task') {
    const task = state.tasks.find((item) => item.id === id);
    if (task) { task.done = !task.done; state.activity[state.activity.length - 1] = Math.max(0, Math.min(4, (state.activity.at(-1) || 0) + (task.done ? 1 : -1))); saveState(); render(); }
  }
  if (action === 'open-task') openTaskDialog();
  if (action === 'open-note') openNoteDialog();
  if (action === 'open-focus') openFocus();
  if (action === 'add-subject') addSubject();
  if (action === 'add-topic') addTopic(subject);
  if (action === 'export-data') downloadData();
  if (action === 'toggle-theme') { state.profile.theme = state.profile.theme === 'dark' ? 'light' : 'dark'; saveState(); render(); }
  if (action === 'reset-data' && window.confirm('Reset all ORBIT data saved in this browser? This cannot be undone.')) { state = structuredClone(starterData); saveState(); render(); notify('Starter workspace restored.'); }
});
content.addEventListener('change', (event) => {
  if (event.target.id === 'import-file') {
    const [file] = event.target.files;
    if (!file) return;
    file.text().then((text) => {
      const imported = JSON.parse(text);
      if (!Array.isArray(imported.subjects) || !Array.isArray(imported.tasks) || !Array.isArray(imported.notes)) throw new Error('Unsupported workspace format');
      state = { ...structuredClone(starterData), ...imported };
      saveState(); render(); notify('Workspace imported.');
    }).catch(() => notify('That file is not a valid ORBIT workspace export.'));
    event.target.value = '';
    return;
  }
  const select = event.target.closest('[data-action="topic-state"]');
  if (!select) return;
  const topic = subjectFor(select.dataset.subject)?.topics[Number(select.dataset.topic)];
  if (topic) { topic.state = select.value; saveState(); render(); }
});
document.querySelector('#task-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.tasks.push({ id: `task-${Date.now()}`, title: String(form.get('title')).trim(), subjectId: String(form.get('subject')), minutes: Number(form.get('minutes')), date: String(form.get('date')), done: false });
  saveState(); dialogTask.close(); event.currentTarget.reset(); render(); notify('Task added to your plan.');
});
document.querySelector('#note-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.notes.unshift({ id: `note-${Date.now()}`, title: String(form.get('title')).trim(), body: String(form.get('body')).trim(), subjectId: String(form.get('subject')), updated: today });
  saveState(); dialogNote.close(); event.currentTarget.reset(); render(); notify('Note saved.');
});
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
document.querySelector('#theme-toggle').addEventListener('click', () => {
  state.profile.theme = state.profile.theme === 'dark' ? 'light' : 'dark'; saveState(); render();
});
document.querySelector('#search-input').addEventListener('input', (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  if (searchTerm && !['subjects', 'today', 'notes'].includes(state.activeView)) state.activeView = 'subjects';
  render();
  document.querySelector('#search-input').focus();
  document.querySelector('#search-input').value = event.target.value;
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#search-input').focus(); }
});
document.querySelector('#timer-toggle').addEventListener('click', (event) => {
  const toggleButton = event.currentTarget;
  if (timerHandle) {
    clearInterval(timerHandle); timerHandle = null; toggleButton.innerHTML = 'Resume focus <span>▶</span>'; return;
  }
  toggleButton.innerHTML = 'Pause session <span>Ⅱ</span>';
  timerHandle = setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);
    document.querySelector('#timer-readout').textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
    if (timerSeconds === 0) { clearInterval(timerHandle); timerHandle = null; state.activity[state.activity.length - 1] = (state.activity.at(-1) || 0) + 1; saveState(); notify('Focus session complete. Take a short break.'); toggleButton.innerHTML = 'Start focus <span>▶</span>'; }
  }, 1000);
});
document.querySelector('#timer-reset').addEventListener('click', () => {
  clearInterval(timerHandle); timerHandle = null; timerSeconds = 25 * 60;
  document.querySelector('#timer-readout').textContent = '25:00';
  document.querySelector('#timer-toggle').innerHTML = 'Start focus <span>▶</span>';
});
document.querySelector('#focus-dialog').addEventListener('close', () => {
  if (timerHandle) document.querySelector('#timer-toggle').innerHTML = 'Resume focus <span>▶</span>';
  clearInterval(timerHandle); timerHandle = null;
});

render();