'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Command,
  Download,
  Focus,
  Gauge,
  GraduationCap,
  Import,
  Library,
  ListChecks,
  Moon,
  NotebookPen,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { findSubject, findTopic, revisionStatus, searchData, semesterProgress, subjectProgress, topicCompletion } from '@/lib/progress';
import { AppPage, LearningState, Note, OrbitData, StudyTask, Subject } from '@/lib/types';
import { useOrbitStore } from '@/store/useOrbitStore';

const navItems: { page: AppPage; label: string; icon: typeof Gauge }[] = [
  { page: 'overview', label: 'Overview', icon: Gauge },
  { page: 'subjects', label: 'Subjects', icon: Library },
  { page: 'today', label: 'Today', icon: ClipboardList },
  { page: 'revision', label: 'Revision', icon: CalendarClock },
  { page: 'practice', label: 'Practice', icon: ListChecks },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'notes', label: 'Notes', icon: NotebookPen },
  { page: 'settings', label: 'Settings', icon: Settings },
];

const stateLabels: Record<LearningState, string> = {
  'not-started': 'Not Started',
  learning: 'Learning',
  practising: 'Practising',
  completed: 'Completed',
};

const stateStyles: Record<LearningState, string> = {
  'not-started': 'border-white/10 bg-white/[0.03] text-[var(--muted)]',
  learning: 'border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]',
  practising: 'border-[var(--warning)]/40 bg-[rgba(215,174,104,0.12)] text-[var(--warning)]',
  completed: 'border-[var(--success)]/35 bg-[rgba(120,198,163,0.12)] text-[var(--success)]',
};

export function OrbitApp() {
  const data = useOrbitStore((state) => state.data);
  const updatePreferences = useOrbitStore((state) => state.updatePreferences);

  useEffect(() => {
    document.documentElement.dataset.theme = data.preferences.theme;
  }, [data.preferences.theme]);

  return (
    <div className="min-h-screen text-[var(--text)]">
      <AnimatePresence>{!data.preferences.onboardingComplete && <Onboarding />}</AnimatePresence>
      <AppFrame />
      <FocusMode />
      <SearchOverlay />
      <TopicPanel />
      <button
        type="button"
        onClick={() => updatePreferences({ theme: data.preferences.theme === 'dark' ? 'light' : 'dark' })}
        className="fixed bottom-24 right-4 z-30 hidden h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] shadow-soft md:flex"
        aria-label="Toggle theme"
      >
        {data.preferences.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
}

function AppFrame() {
  const activePage = useOrbitStore((state) => state.activePage);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-24 lg:pb-0 lg:pl-72">
        <TopBar />
        <div className="mx-auto max-w-[1540px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={activePage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              {activePage === 'overview' && <OverviewPage />}
              {activePage === 'subjects' && <SubjectPage />}
              {activePage === 'today' && <TodayPage />}
              {activePage === 'revision' && <RevisionPage />}
              {activePage === 'practice' && <PracticePage />}
              {activePage === 'analytics' && <AnalyticsPage />}
              {activePage === 'notes' && <NotesPage />}
              {activePage === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function Sidebar() {
  const data = useOrbitStore((state) => state.data);
  const activePage = useOrbitStore((state) => state.activePage);
  const setPage = useOrbitStore((state) => state.setPage);
  const setSubject = useOrbitStore((state) => state.setSubject);
  const activeSubjectId = useOrbitStore((state) => state.activeSubjectId);
  const [subjectsOpen, setSubjectsOpen] = useState(true);
  const progress = semesterProgress(data);

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-5 backdrop-blur-xl lg:block">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-glow">
          <CircleDot size={20} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide">ORBIT</div>
          <div className="text-xs text-[var(--muted)]">Semester Operating System</div>
        </div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.page;
          if (item.page === 'subjects') {
            return (
              <div key={item.page}>
                <button type="button" onClick={() => { setPage('subjects'); setSubjectsOpen(!subjectsOpen); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]'}`}>
                  <Icon size={17} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown size={15} className={`transition ${subjectsOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {subjectsOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="ml-6 mt-1 space-y-1 border-l border-[var(--border)] pl-3">
                        {data.semester.subjects.map((subject) => (
                          <button key={subject.id} type="button" onClick={() => setSubject(subject.id)} className={`block w-full rounded-lg px-2 py-2 text-left text-xs transition ${activeSubjectId === subject.id && activePage === 'subjects' ? 'bg-white/[0.06] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
                            {subject.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
          return (
            <button key={item.page} type="button" onClick={() => setPage(item.page)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-[var(--accent-soft)] text-[var(--text)]' : 'text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]'}`}>
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Semester progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="h-full rounded-full bg-[var(--accent)]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const activePage = useOrbitStore((state) => state.activePage);
  const setSearchOpen = useOrbitStore((state) => state.setSearchOpen);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const addTask = useOrbitStore((state) => state.addTask);
  const data = useOrbitStore((state) => state.data);
  const title = navItems.find((item) => item.page === activePage)?.label ?? 'Overview';
  const streak = 8;
  const firstSubject = data.semester.subjects[0];

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_84%,transparent)] px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1540px] items-center gap-3">
        <PanelLeft className="text-[var(--muted)] lg:hidden" size={18} />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{data.semester.program}</div>
          <h1 className="truncate text-xl font-semibold">{title}</h1>
        </div>
        <button type="button" onClick={() => setSearchOpen(true)} className="hidden min-w-[280px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/35 hover:text-[var(--text)] md:flex">
          <Search size={16} />
          Search subjects, modules, topics...
          <Command size={13} className="ml-auto" />
        </button>
        <button type="button" onClick={() => addTask({ subjectId: firstSubject.id, title: 'Quick captured study task', actionType: 'Learn', estimatedMinutes: 25, priority: 'Medium', scheduledFor: new Date().toISOString().slice(0, 10) })} className="hidden items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 sm:flex">
          <Plus size={16} />
          Quick Add
        </button>
        <button type="button" onClick={() => startFocus()} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent)]/40" aria-label="Open focus mode">
          <Focus size={17} />
        </button>
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] sm:flex">
          <Sparkles size={15} className="text-[var(--warning)]" />
          {streak} day streak
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] text-sm font-semibold">A</div>
      </div>
    </header>
  );
}

function MobileNav() {
  const activePage = useOrbitStore((state) => state.activePage);
  const setPage = useOrbitStore((state) => state.setPage);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_91%,transparent)] px-2 py-2 backdrop-blur-xl lg:hidden">
      {navItems.slice(0, 5).map((item) => {
        const Icon = item.icon;
        const active = activePage === item.page;
        return (
          <button key={item.page} type="button" onClick={() => setPage(item.page)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
            <Icon size={17} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function OverviewPage() {
  const data = useOrbitStore((state) => state.data);
  const setSubject = useOrbitStore((state) => state.setSubject);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const progress = semesterProgress(data);
  const tasks = todaysTasks(data);
  const nextTask = tasks.find((task) => !task.completed) ?? tasks[0];
  const focusSubject = findSubject(data, nextTask?.subjectId ?? 'backend') ?? data.semester.subjects[0];
  const topic = findTopic(data, nextTask?.topicId)?.topic;
  const subjectRows = data.semester.subjects.map((subject) => ({ subject, ...subjectProgress(subject) }));
  const revisions = data.revisions.filter((revision) => ['due', 'overdue'].includes(revisionStatus(revision))).slice(0, 4);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
          <div className="flex-1">
            <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--accent)]">
              <GraduationCap size={14} />
              {data.semester.title} control room
            </div>
            <h2 className="max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">Good evening. Your next best move is clear.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">Stay with one meaningful academic action at a time. ORBIT is tracking syllabus progress, revision pressure, practice load and your current momentum.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Recommended next task</div>
                <div className="mt-2 text-lg font-semibold">{nextTask?.title ?? 'Plan your first task'}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">{focusSubject.name}{topic ? ` -> ${topic.title}` : ''}</div>
              </div>
              <button type="button" onClick={() => startFocus(nextTask?.id)} className="rounded-2xl bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-white transition hover:brightness-110">Continue learning</button>
            </div>
          </div>
          <OrbitVisual subjects={data.semester.subjects} progress={progress} />
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Today's Plan" action="Drag to reorder" />
        <TaskList tasks={tasks.slice(0, 4)} />
      </section>

      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Subject Progress" action="Open roadmap" />
        <div className="space-y-3">
          {subjectRows.map((row) => (
            <button key={row.subject.id} type="button" onClick={() => setSubject(row.subject.id)} className="group w-full rounded-xl border border-[var(--border)] bg-white/[0.025] p-3 text-left transition hover:border-[var(--accent)]/30 hover:bg-white/[0.05]">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.subject.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.subject.name}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{row.completed}/{row.total} topics · {row.currentModule} · last activity {row.subject.modules.flatMap((module) => module.topics).find((topic) => topic.lastActivity)?.lastActivity ?? 'not started'}</div>
                </div>
                <div className="w-16 text-right text-sm font-semibold">{row.percentage}%</div>
              </div>
              <ProgressBar value={row.percentage} className="mt-3" />
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5">
        <section className="panel p-5 sm:p-6">
          <SectionHeader title="Revision Due" action="Revise now" />
          <div className="space-y-3">
            {revisions.length ? revisions.map((revision) => {
              const found = findTopic(data, revision.topicId);
              return <RevisionRow key={revision.id} revisionId={revision.id} title={found?.topic.title ?? 'Topic'} meta={`${found?.subject.shortName ?? 'Subject'} · Revision ${revision.round}`} status={revisionStatus(revision)} />;
            }) : <EmptyState title="No urgent revisions" body="Completed topics will automatically create spaced revision checkpoints." />}
          </div>
        </section>
        <section className="panel p-5 sm:p-6">
          <SectionHeader title="Weekly Activity" action="Study minutes" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyActivity(data)}>
                <defs>
                  <linearGradient id="minutes" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }} />
                <Area type="monotone" dataKey="minutes" stroke="var(--accent)" fill="url(#minutes)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-5 sm:p-6">
          <SectionHeader title="Current Momentum" />
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            <MomentumLine text="3 topics completed this week" />
            <MomentumLine text="Backend is your most active subject" />
            <MomentumLine text="Probability needs attention before the first assessment" />
          </div>
        </section>
      </div>
    </div>
  );
}

function OrbitVisual({ subjects, progress }: { subjects: Subject[]; progress: number }) {
  return (
    <div className="relative mx-auto h-80 w-80 shrink-0">
      <div className="absolute inset-8 rounded-full border border-[var(--border)]" />
      <div className="absolute inset-16 rounded-full border border-dashed border-[var(--border)]" />
      <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--elevated)] shadow-glow">
        <div className="text-center">
          <div className="text-3xl font-semibold">{progress}%</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Semester</div>
        </div>
      </div>
      {subjects.map((subject, index) => {
        const angle = (index / subjects.length) * Math.PI * 2 - Math.PI / 2;
        const x = 144 + Math.cos(angle) * 126;
        const y = 144 + Math.sin(angle) * 126;
        const percent = subjectProgress(subject).percentage;
        return (
          <div key={subject.id} className="absolute grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold shadow-soft" style={{ left: x, top: y, color: subject.accent }}>
            <div className="absolute inset-0 rounded-2xl opacity-20" style={{ background: `conic-gradient(${subject.accent} ${percent}%, transparent 0)` }} />
            <span className="relative">{subject.shortName}</span>
          </div>
        );
      })}
    </div>
  );
}

function SubjectPage() {
  const data = useOrbitStore((state) => state.data);
  const activeSubjectId = useOrbitStore((state) => state.activeSubjectId);
  const setSubject = useOrbitStore((state) => state.setSubject);
  const subject = findSubject(data, activeSubjectId) ?? data.semester.subjects[0];
  const [tab, setTab] = useState('Roadmap');
  const progress = subjectProgress(subject);
  const tabs = ['Roadmap', 'Modules', 'Practice', 'Notes', 'Revision', 'Analytics'];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {data.semester.subjects.map((item) => <button key={item.id} onClick={() => setSubject(item.id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs ${item.id === subject.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{item.shortName}</button>)}
      </div>
      <section className="panel overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{subject.code} · {subject.credits} credits</div>
            <h2 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{subject.name}</h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">A subject operating surface for roadmap progression, module checkpoints, practice, notes, revision and readiness.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Completion" value={`${progress.percentage}%`} />
            <Metric label="Study hours" value={`${subject.totalStudyHours}h`} />
            <Metric label="Topics done" value={`${progress.completed}/${progress.total}`} />
            <Metric label="Readiness" value={`${subject.assessmentReadiness}%`} />
          </div>
        </div>
        <div className="mt-6">
          <ProgressBar value={progress.percentage} />
          <div className="mt-2 text-xs text-[var(--muted)]">Current module: {progress.currentModule}</div>
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm transition ${tab === item ? 'bg-[var(--elevated)] text-[var(--text)] shadow-soft' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>{item}</button>)}
      </div>
      {tab === 'Roadmap' && <Roadmap subject={subject} />}
      {tab === 'Modules' && <ModuleView subject={subject} />}
      {tab === 'Practice' && <PracticePage subjectFilter={subject.id} />}
      {tab === 'Notes' && <NotesPage subjectFilter={subject.id} />}
      {tab === 'Revision' && <RevisionPage subjectFilter={subject.id} />}
      {tab === 'Analytics' && <SubjectAnalytics subject={subject} />}
    </div>
  );
}

function Roadmap({ subject }: { subject: Subject }) {
  const setTopic = useOrbitStore((state) => state.setTopic);
  return (
    <section className="panel p-5 sm:p-7">
      <SectionHeader title="Roadmap" action="Recommended path, not locked" />
      <div className="relative space-y-10 before:absolute before:bottom-8 before:left-5 before:top-8 before:w-px before:bg-gradient-to-b before:from-[var(--accent)] before:via-[var(--border)] before:to-transparent">
        {subject.modules.map((module, moduleIndex) => (
          <div key={module.id} className="relative pl-14">
            <div className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--elevated)] text-sm font-semibold">{moduleIndex + 1}</div>
            <h3 className="text-xl font-semibold">{module.title}</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {module.topics.map((topic, index) => {
                const complete = topicCompletion(topic);
                const recommendedLocked = moduleIndex > 0 && index > 1 && complete === 0;
                return (
                  <button key={topic.id} type="button" onClick={() => setTopic(topic.id)} className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)]/35 ${recommendedLocked ? 'border-dashed border-[var(--border)] opacity-70' : 'border-[var(--border)] bg-white/[0.025]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{topic.title}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{topic.difficulty} · {topic.estimatedMinutes} min</div>
                      </div>
                      <StateBadge state={topic.state} />
                    </div>
                    <ProgressBar value={complete} className="mt-4" />
                    <div className="mt-3 text-xs text-[var(--muted)]">{recommendedLocked ? 'Recommended later, still accessible' : `${topic.checkpoints.filter((item) => item.completed).length}/5 checkpoints`}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModuleView({ subject }: { subject: Subject }) {
  const setTopic = useOrbitStore((state) => state.setTopic);
  const addCustomTopic = useOrbitStore((state) => state.addCustomTopic);
  const [newTopic, setNewTopic] = useState('');
  return (
    <section className="space-y-4">
      <div className="panel flex flex-col gap-3 p-4 sm:flex-row">
        <input value={newTopic} onChange={(event) => setNewTopic(event.target.value)} placeholder="Add a custom topic to this subject" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
        <button type="button" onClick={() => { addCustomTopic(subject.id, newTopic); setNewTopic(''); }} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Add topic</button>
      </div>
      {subject.modules.map((module) => (
        <details key={module.id} open className="panel overflow-hidden">
          <summary className="cursor-pointer border-b border-[var(--border)] p-5 text-lg font-semibold">{module.title}</summary>
          <div className="divide-y divide-[var(--border)]">
            {module.topics.map((topic) => (
              <button key={topic.id} type="button" onClick={() => setTopic(topic.id)} className="grid w-full gap-3 p-4 text-left transition hover:bg-white/[0.035] md:grid-cols-[1fr_110px_110px_120px_100px] md:items-center">
                <div>
                  <div className="font-medium">{topic.title}</div>
                  <div className="text-xs text-[var(--muted)]">{topic.description}</div>
                </div>
                <span className="text-sm text-[var(--muted)]">{topic.difficulty}</span>
                <span className="text-sm text-[var(--muted)]">{topic.estimatedMinutes} min</span>
                <StateBadge state={topic.state} />
                <span className="text-sm text-[var(--muted)]">{topic.checkpoints.filter((item) => item.completed).length}/5 done</span>
              </button>
            ))}
          </div>
        </details>
      ))}
    </section>
  );
}

function TodayPage() {
  const data = useOrbitStore((state) => state.data);
  const addTask = useOrbitStore((state) => state.addTask);
  const [capture, setCapture] = useState('');
  const tasks = todaysTasks(data);
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Today's primary goal" action={data.preferences.dailyTime} />
        <h2 className="font-serif text-4xl leading-tight">Finish one hard thing before adding more.</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Balanced plan: one learning block, one coding/practice block, one revision action and one notes cleanup.</p>
        <div className="mt-6 flex gap-2">
          <input value={capture} onChange={(event) => setCapture(event.target.value)} placeholder="Quick capture a task..." className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
          <button type="button" onClick={() => { addTask({ subjectId: data.semester.subjects[0].id, title: capture || 'Captured task', actionType: 'Learn', estimatedMinutes: 25, priority: 'Medium', scheduledFor: new Date().toISOString().slice(0, 10) }); setCapture(''); }} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Capture</button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Planned tasks" />
        <TaskList tasks={tasks.filter((task) => !task.completed)} />
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Completed tasks" />
        <TaskList tasks={tasks.filter((task) => task.completed)} />
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Time-block view" action="Flexible" />
        <div className="space-y-3">
          {tasks.map((task, index) => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"><span className="w-14 text-xs text-[var(--muted)]">{9 + index}:00</span><div className="h-8 w-1 rounded-full bg-[var(--accent)]" /><div className="text-sm">{task.title}</div><span className="ml-auto text-xs text-[var(--muted)]">{task.estimatedMinutes}m</span></div>)}
        </div>
      </section>
      <section className="panel xl:col-span-2 p-5 sm:p-6">
        <SectionHeader title="End-of-day reflection" />
        <textarea className="min-h-28 w-full resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm" placeholder="What moved? What felt confusing? What should tomorrow protect?" />
      </section>
    </div>
  );
}

function RevisionPage({ subjectFilter }: { subjectFilter?: string }) {
  const data = useOrbitStore((state) => state.data);
  const revisions = data.revisions.filter((revision) => !subjectFilter || revision.subjectId === subjectFilter);
  const groups = ['overdue', 'due', 'upcoming', 'completed'] as const;
  return (
    <div className="grid gap-5 xl:grid-cols-4">
      {groups.map((group) => (
        <section key={group} className="panel p-5">
          <SectionHeader title={group === 'due' ? 'Due today' : group[0].toUpperCase() + group.slice(1)} />
          <div className="space-y-3">
            {revisions.filter((revision) => revisionStatus(revision) === group).map((revision) => {
              const found = findTopic(data, revision.topicId);
              return <RevisionRow key={revision.id} revisionId={revision.id} title={found?.topic.title ?? 'Topic'} meta={`${found?.subject.name ?? ''} · ${revision.dueDate}`} status={group} />;
            })}
            {!revisions.some((revision) => revisionStatus(revision) === group) && <EmptyState title="Nothing here" body="Revision items move here as topics are completed." />}
          </div>
        </section>
      ))}
    </div>
  );
}

function PracticePage({ subjectFilter }: { subjectFilter?: string }) {
  const data = useOrbitStore((state) => state.data);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const topics = data.semester.subjects.filter((subject) => !subjectFilter || subject.id === subjectFilter).flatMap((subject) => subject.modules.flatMap((module) => module.topics.map((topic) => ({ subject, module, topic })))).filter(({ topic }) => topic.state !== 'completed');
  return (
    <section className="panel p-5 sm:p-6">
      <SectionHeader title="Practice queue" action={`${topics.length} open topics`} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {topics.slice(0, 18).map(({ subject, topic }) => (
          <button key={topic.id} type="button" onClick={() => setTopic(topic.id)} className="rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-[var(--accent)]/40 hover:bg-white/[0.035]">
            <div className="text-xs text-[var(--muted)]">{subject.shortName}</div>
            <div className="mt-1 font-medium">{topic.title}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]"><span>{topic.difficulty}</span><span>{topic.codingQuestions.length || topic.subtopics.length} prompts</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function AnalyticsPage() {
  const data = useOrbitStore((state) => state.data);
  const subjectData = data.semester.subjects.map((subject) => ({ name: subject.shortName, progress: subjectProgress(subject).percentage, hours: subject.totalStudyHours, color: subject.accent }));
  const states = ['not-started', 'learning', 'practising', 'completed'].map((state) => ({ name: stateLabels[state as LearningState], value: data.semester.subjects.flatMap((subject) => subject.modules.flatMap((module) => module.topics)).filter((topic) => topic.state === state).length }));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Subject-wise completion" />
        <div className="h-72"><ResponsiveContainer><BarChart data={subjectData}><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }} /><Bar dataKey="progress" radius={[8, 8, 0, 0]}>{subjectData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Confidence distribution" />
        <div className="h-72"><ResponsiveContainer><PieChart><Pie data={states} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={3}>{states.map((_, index) => <Cell key={index} fill={['#696572', '#A78BFA', '#D7AE68', '#78C6A3'][index]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }} /></PieChart></ResponsiveContainer></div>
      </section>
      <section className="panel p-5 sm:p-6 xl:col-span-2">
        <SectionHeader title="Assessment readiness" action="Non-vanity signals" />
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Overall progress" value={`${semesterProgress(data)}%`} />
          <Metric label="Revision consistency" value={`${Math.round((data.revisions.filter((revision) => revision.completedAt).length / Math.max(data.revisions.length, 1)) * 100)}%`} />
          <Metric label="Backlog" value={`${data.revisions.filter((revision) => revisionStatus(revision) === 'overdue').length} overdue`} />
        </div>
      </section>
    </div>
  );
}

function SubjectAnalytics({ subject }: { subject: Subject }) {
  const modules = subject.modules.map((module) => ({ name: module.title, progress: Math.round(module.topics.reduce((sum, topic) => sum + topicCompletion(topic), 0) / Math.max(module.topics.length, 1)) }));
  return <section className="panel p-5 sm:p-6"><SectionHeader title="Module analytics" /><div className="h-64"><ResponsiveContainer><BarChart data={modules}><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }} /><Bar dataKey="progress" fill={subject.accent} radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></section>;
}

function NotesPage({ subjectFilter }: { subjectFilter?: string }) {
  const data = useOrbitStore((state) => state.data);
  const addNote = useOrbitStore((state) => state.addNote);
  const [query, setQuery] = useState('');
  const [body, setBody] = useState('');
  const notes = data.notes.filter((note) => (!subjectFilter || note.subjectId === subjectFilter) && `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Create note" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or title..." className="mb-3 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Plain text, markdown-style notes, code blocks or resource links..." className="min-h-44 w-full resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm" />
        <button type="button" onClick={() => { addNote({ title: query || 'Untitled note', body: body || 'Empty note', subjectId: subjectFilter ?? data.semester.subjects[0].id, important: false, confusing: false }); setBody(''); }} className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Save note</button>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Notes library" action={`${notes.length} notes`} />
        <div className="grid gap-3">
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
          {!notes.length && <EmptyState title="No notes found" body="Attach notes to subjects, modules, topics or subtopics." />}
        </div>
      </section>
    </div>
  );
}

function SettingsPage() {
  const data = useOrbitStore((state) => state.data);
  const resetProgress = useOrbitStore((state) => state.resetProgress);
  const importData = useOrbitStore((state) => state.importData);
  const addCustomSubject = useOrbitStore((state) => state.addCustomSubject);
  const updatePreferences = useOrbitStore((state) => state.updatePreferences);
  const [subjectName, setSubjectName] = useState('');
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orbit-semester-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Data controls" />
        <div className="grid gap-3">
          <button type="button" onClick={exportData} className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-left text-sm"><Download size={16} /> Export all data as JSON</button>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm"><Import size={16} /> Import JSON<input type="file" accept="application/json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) importData(JSON.parse(await file.text()) as OrbitData); }} /></label>
          <button type="button" onClick={resetProgress} className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/35 p-3 text-left text-sm text-[var(--danger)]"><RotateCcw size={16} /> Reset progress</button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Semester structure" />
        <div className="flex gap-2">
          <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Add custom subject" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
          <button type="button" onClick={() => { addCustomSubject(subjectName); setSubjectName(''); }} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Add</button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6 xl:col-span-2">
        <SectionHeader title="Preferences" />
        <div className="grid gap-3 md:grid-cols-3">
          {(['One topic at a time', 'Daily balanced plan', 'Exam sprint', 'Project-focused'] as const).map((style) => <button key={style} onClick={() => updatePreferences({ workStyle: style })} className={`rounded-xl border p-3 text-sm ${data.preferences.workStyle === style ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)]'}`}>{style}</button>)}
        </div>
      </section>
    </div>
  );
}

function TopicPanel() {
  const data = useOrbitStore((state) => state.data);
  const topicId = useOrbitStore((state) => state.activeTopicId);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const toggleCheckpoint = useOrbitStore((state) => state.toggleCheckpoint);
  const updateTopicState = useOrbitStore((state) => state.updateTopicState);
  const updateTopicMeta = useOrbitStore((state) => state.updateTopicMeta);
  const addResource = useOrbitStore((state) => state.addResource);
  const addCodingQuestion = useOrbitStore((state) => state.addCodingQuestion);
  const addNote = useOrbitStore((state) => state.addNote);
  const deleteCustomTopic = useOrbitStore((state) => state.deleteCustomTopic);
  const found = findTopic(data, topicId);
  const [resource, setResource] = useState('');
  const [question, setQuestion] = useState('');
  const [personalNote, setPersonalNote] = useState('');

  return (
    <AnimatePresence>
      {found && (
        <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 240 }} className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-[var(--border)] bg-[var(--bg)] p-5 shadow-soft sm:max-w-xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{found.subject.name} {'->'} {found.module.title}</div>
              <h2 className="mt-2 text-3xl font-semibold">{found.topic.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{found.topic.description}</p>
            </div>
            <button type="button" onClick={() => setTopic(undefined)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border)]"><X size={17} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Difficulty" value={found.topic.difficulty} />
            <Metric label="Estimate" value={`${found.topic.estimatedMinutes}m`} />
            <Metric label="Progress" value={`${topicCompletion(found.topic)}%`} />
          </div>
          <div className="mt-5 grid gap-3">
            <label className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Current status</label>
            <select value={found.topic.state} onChange={(event) => updateTopicState(found.topic.id, event.target.value as LearningState)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              {Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="mt-6 space-y-3">
            <SectionHeader title="Checklist" />
            {found.topic.checkpoints.map((checkpoint) => (
              <button key={checkpoint.key} type="button" onClick={() => toggleCheckpoint(found.topic.id, checkpoint.key)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition hover:bg-white/[0.035]">
                <span className={`grid h-6 w-6 place-items-center rounded-lg border transition ${checkpoint.completed ? 'border-[var(--success)] bg-[var(--success)] text-black' : 'border-[var(--border)]'}`}>{checkpoint.completed && <Check size={14} />}</span>
                <span className="text-sm">{checkpoint.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Confidence: {found.topic.confidence}</label>
            <input type="range" min={1} max={5} value={found.topic.confidence} onChange={(event) => updateTopicMeta(found.topic.id, { confidence: Number(event.target.value) })} className="mt-3 w-full accent-[var(--accent)]" />
            <div className="mt-2 text-xs text-[var(--muted)]">1 I do not understand this · 3 I can explain it · 5 I can solve it independently</div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => updateTopicMeta(found.topic.id, { confusing: !found.topic.confusing })} className={`rounded-xl border p-3 text-sm ${found.topic.confusing ? 'border-[var(--warning)] bg-[rgba(215,174,104,0.12)]' : 'border-[var(--border)]'}`}>Mark confusing</button>
            <button type="button" onClick={() => updateTopicMeta(found.topic.id, { important: !found.topic.important })} className={`rounded-xl border p-3 text-sm ${found.topic.important ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)]'}`}>Mark important</button>
          </div>
          <div className="mt-6 grid gap-3">
            <input value={resource} onChange={(event) => setResource(event.target.value)} placeholder="Add resource link" className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
            <button onClick={() => { addResource(found.topic.id, resource); setResource(''); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Add resource</button>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Add coding/practice question" className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
            <button onClick={() => { addCodingQuestion(found.topic.id, question); setQuestion(''); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Add question</button>
            <textarea value={personalNote} onChange={(event) => setPersonalNote(event.target.value)} placeholder="Add personal note..." className="min-h-24 resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm" />
            <button onClick={() => { addNote({ title: `${found.topic.title} note`, body: personalNote || 'Topic note', subjectId: found.subject.id, moduleId: found.module.id, topicId: found.topic.id, important: !!found.topic.important, confusing: !!found.topic.confusing }); setPersonalNote(''); }} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Save note</button>
            {found.topic.custom && <button onClick={() => deleteCustomTopic(found.topic.id)} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--danger)]/35 px-3 py-2 text-sm text-[var(--danger)]"><Trash2 size={15} /> Delete custom topic</button>}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function FocusMode() {
  const data = useOrbitStore((state) => state.data);
  const focusTaskId = useOrbitStore((state) => state.focusTaskId);
  const endFocus = useOrbitStore((state) => state.endFocus);
  const task = data.tasks.find((item) => item.id === focusTaskId);
  const found = findTopic(data, task?.topicId);
  const [seconds, setSeconds] = useState(25 * 60);
  useEffect(() => {
    if (!focusTaskId) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [focusTaskId]);
  return (
    <AnimatePresence>
      {task && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] grid place-items-center bg-[var(--bg)] p-5">
          <div className="w-full max-w-3xl text-center">
            <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]"><Timer size={32} /></div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{found?.subject.name ?? 'Study session'} · {found?.topic.title ?? task.actionType}</div>
            <h2 className="mt-3 font-serif text-5xl">{task.title}</h2>
            <div className="my-10 text-7xl font-semibold tabular-nums">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</div>
            <textarea placeholder="Scratch notes stay private on this device..." className="min-h-36 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left text-sm" />
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={() => endFocus(0)} className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm">Pause</button>
              <button onClick={() => endFocus(task.estimatedMinutes)} className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Complete session</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SearchOverlay() {
  const open = useOrbitStore((state) => state.searchOpen);
  const setOpen = useOrbitStore((state) => state.setSearchOpen);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const data = useOrbitStore((state) => state.data);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchData(data, query), [data, query]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/45 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <motion.div initial={{ y: -16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, scale: 0.98 }} onClick={(event) => event.stopPropagation()} className="mx-auto mt-16 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4 shadow-soft">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <Search size={18} className="text-[var(--muted)]" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search DSA -> Module I -> Linked Lists..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="mt-3 max-h-[55vh] overflow-y-auto thin-scrollbar">
              {results.map((result) => (
                <button key={`${result.type}-${result.id}`} onClick={() => { if (result.type === 'Topic') setTopic(result.id); setOpen(false); }} className="block w-full rounded-xl p-3 text-left transition hover:bg-white/[0.05]">
                  <div className="text-sm font-medium">{result.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{result.type} · {result.path}</div>
                </button>
              ))}
              {!results.length && <EmptyState title="Start typing to search" body="Find subjects, modules, topics, subtopics, notes and practice tasks." />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Onboarding() {
  const completeOnboarding = useOrbitStore((state) => state.completeOnboarding);
  const [step, setStep] = useState(0);
  const [workStyle, setWorkStyle] = useState<'One topic at a time' | 'Daily balanced plan' | 'Exam sprint' | 'Project-focused'>('Daily balanced plan');
  const [dailyTime, setDailyTime] = useState<'30 minutes' | '1 hour' | '2 hours' | 'Flexible'>('1 hour');
  const steps = [
    <OnboardingStep key="control" title="What are you trying to control?" options={['My whole semester']} selected="My whole semester" onSelect={() => setStep(1)} />,
    <OnboardingStep key="style" title="How do you want to work?" options={['One topic at a time', 'Daily balanced plan', 'Exam sprint', 'Project-focused']} selected={workStyle} onSelect={(value) => { setWorkStyle(value as typeof workStyle); setStep(2); }} />,
    <OnboardingStep key="time" title="How much time can you realistically study each day?" options={['30 minutes', '1 hour', '2 hours', 'Flexible']} selected={dailyTime} onSelect={(value) => { setDailyTime(value as typeof dailyTime); completeOnboarding({ workStyle, dailyTime: value as typeof dailyTime }); }} />,
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-[var(--bg)] p-5">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-soft">
        <div className="mb-8 flex items-center justify-between">
          <div><div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">First launch</div><h1 className="mt-1 text-2xl font-semibold">Tune ORBIT</h1></div>
          <button onClick={() => completeOnboarding()} className="text-sm text-[var(--muted)]">Skip</button>
        </div>
        {steps[step]}
      </div>
    </motion.div>
  );
}

function OnboardingStep({ title, options, selected, onSelect }: { title: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
  return <div><h2 className="font-serif text-4xl">{title}</h2><div className="mt-6 grid gap-3">{options.map((option) => <button key={option} onClick={() => onSelect(option)} className={`rounded-2xl border p-4 text-left text-sm transition ${selected === option ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-white/[0.04]'}`}>{option}</button>)}</div></div>;
}

function TaskList({ tasks }: { tasks: StudyTask[] }) {
  const data = useOrbitStore((state) => state.data);
  const toggleTask = useOrbitStore((state) => state.toggleTask);
  const reorderTasks = useOrbitStore((state) => state.reorderTasks);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  if (!tasks.length) return <EmptyState title="No tasks" body="Capture a task or complete a topic to generate study work." />;
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => {
        const subject = findSubject(data, task.subjectId);
        const topic = findTopic(data, task.topicId)?.topic;
        return (
          <div key={task.id} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) reorderTasks(dragIndex, index); setDragIndex(null); }} className="rounded-2xl border border-[var(--border)] bg-white/[0.025] p-3 transition hover:border-[var(--accent)]/30">
            <div className="flex items-start gap-3">
              <button onClick={() => toggleTask(task.id)} className={`mt-0.5 grid h-6 w-6 place-items-center rounded-lg border transition ${task.completed ? 'border-[var(--success)] bg-[var(--success)] text-black' : 'border-[var(--border)]'}`}>{task.completed && <Check size={14} />}</button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{task.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{subject?.shortName} {topic ? `-> ${topic.title}` : ''} · {task.actionType} · {task.estimatedMinutes}m · {task.priority}</div>
              </div>
              <button onClick={() => startFocus(task.id)} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">Focus</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevisionRow({ revisionId, title, meta, status }: { revisionId: string; title: string; meta: string; status: string }) {
  const completeRevision = useOrbitStore((state) => state.completeRevision);
  const [confidence, setConfidence] = useState(3);
  const color = status === 'overdue' ? 'var(--danger)' : status === 'due' ? 'var(--warning)' : status === 'completed' ? 'var(--success)' : 'var(--accent)';
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{meta}</div>
          {status !== 'completed' && (
            <div className="mt-3 flex items-center gap-2">
              <input type="range" min={1} max={5} value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="min-w-0 flex-1 accent-[var(--accent)]" />
              <button onClick={() => completeRevision(revisionId, confidence)} className="rounded-lg bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-white">Revise now</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: Note }) {
  return <article className="rounded-2xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{note.title}</h3><div className="flex gap-1">{note.important && <span className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] text-[var(--accent)]">Important</span>}{note.confusing && <span className="rounded-md bg-[rgba(215,174,104,0.12)] px-2 py-1 text-[10px] text-[var(--warning)]">Confusing</span>}</div></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{note.body}</p><div className="mt-3 text-xs text-[var(--muted)]">Updated {note.updatedAt}</div></article>;
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</h2>{action && <span className="text-xs text-[var(--muted)]">{action}</span>}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-white/[0.025] p-4"><div className="text-xs text-[var(--muted)]">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>;
}

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`h-1.5 overflow-hidden rounded-full bg-white/[0.06] ${className}`}><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, value))}%` }} className="h-full rounded-full bg-[var(--accent)]" /></div>;
}

function StateBadge({ state }: { state: LearningState }) {
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-[11px] ${stateStyles[state]}`}>{stateLabels[state]}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-center"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-[var(--muted)]">{body}</div></div>;
}

function MomentumLine({ text }: { text: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />{text}</div>;
}

function todaysTasks(data: OrbitData) {
  const day = new Date().toISOString().slice(0, 10);
  return data.tasks.filter((task) => task.scheduledFor === day).sort((a, b) => a.order - b.order);
}

function weeklyActivity(data: OrbitData) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((day, index) => ({ day, minutes: data.sessions[index]?.minutes ?? [20, 45, 30, 70, 50, 35, 55][index], topics: index % 2 ? 1 : 0, questions: 8 + index * 2 }));
}
