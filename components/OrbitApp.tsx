'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Command,
  Copy,
  Download,
  Focus,
  Gauge,
  GraduationCap,
  Home,
  Import,
  Library,
  ListChecks,
  Menu,
  Moon,
  NotebookPen,
  PanelLeft,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { activeSubjects, findSubject, findTopic, getStudyStreak, recommendedNextTask, revisionStatus, searchData, semesterProgress, subjectProgress, topicCompletion, weeklyActivity } from '@/lib/progress';
import { calculateSyllabusStats, ExtractedSyllabus, extractedToOrbitData, extractSyllabus, extractSyllabusText } from '@/lib/syllabusImport';
import { AppPage, LearningState, Module, Note, OrbitData, StudyTask, Subject, Topic } from '@/lib/types';
import { ImportMode, listOrbitBackups, useOrbitStore } from '@/store/useOrbitStore';

const navItems: { page: AppPage; label: string; icon: typeof Gauge }[] = [
  { page: 'overview', label: 'Overview', icon: Gauge },
  { page: 'subjects', label: 'Subjects', icon: Library },
  { page: 'today', label: 'Today', icon: ClipboardList },
  { page: 'revision', label: 'Revision', icon: CalendarClock },
  { page: 'practice', label: 'Practice', icon: ListChecks },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'notes', label: 'Notes', icon: NotebookPen },
  { page: 'history', label: 'History', icon: Timer },
  { page: 'settings', label: 'Settings', icon: Settings },
];

const mobileNavItems: { page: AppPage; label: string; icon: typeof Gauge }[] = [
  { page: 'overview', label: 'Home', icon: Home },
  { page: 'subjects', label: 'Subjects', icon: Library },
  { page: 'today', label: 'Today', icon: ClipboardList },
  { page: 'revision', label: 'Revision', icon: CalendarClock },
  { page: 'settings', label: 'Profile', icon: User },
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

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

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
      <MobileApp />
      <main className="hidden min-w-0 flex-1 pb-24 md:block md:pb-0 md:pl-20 lg:pl-72">
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
              {activePage === 'history' && <HistoryPage />}
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
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-20 border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-3 py-5 backdrop-blur-xl md:block lg:w-72 lg:px-4">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-glow">
          <CircleDot size={20} />
        </div>
        <div className="hidden lg:block">
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
                  <span className="hidden flex-1 text-left lg:block">{item.label}</span>
                  <ChevronDown size={15} className={`hidden transition lg:block ${subjectsOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {subjectsOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="ml-6 mt-1 space-y-1 border-l border-[var(--border)] pl-3">
                        {activeSubjects(data).map((subject) => (
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
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="absolute bottom-5 left-3 right-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:left-4 lg:right-4 lg:p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted)]">
          <span className="hidden lg:inline">Semester progress</span>
          <span className="lg:hidden">Progress</span>
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
  const streak = getStudyStreak(data);
  const recommendation = recommendedNextTask(data, data.preferences.focusModeSubjectId);

  return (
    <header className="sticky top-0 z-20 hidden border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_84%,transparent)] px-4 py-3 backdrop-blur-xl md:block sm:px-6 lg:px-8">
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
        <button type="button" onClick={() => recommendation.subjectId && addTask({ subjectId: recommendation.subjectId, topicId: recommendation.topicId, title: recommendation.title, actionType: recommendation.actionType, estimatedMinutes: recommendation.estimatedMinutes, priority: 'Medium', scheduledFor: new Date().toISOString().slice(0, 10) })} className="hidden items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50 sm:flex" disabled={!recommendation.subjectId}>
          <Plus size={16} />
          Quick Add
        </button>
        <button type="button" onClick={() => startFocus()} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent)]/40" aria-label="Open focus mode">
          <Focus size={17} />
        </button>
        <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] sm:flex">
          <Sparkles size={15} className="text-[var(--warning)]" />
          {streak > 0 ? `${streak} day streak` : 'Your streak begins today'}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] text-sm font-semibold">A</div>
      </div>
    </header>
  );
}

function MobileApp() {
  const activePage = useOrbitStore((state) => state.activePage);
  const setSearchOpen = useOrbitStore((state) => state.setSearchOpen);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>();
  const selectedSubject = useOrbitStore((state) => (selectedSubjectId ? findSubject(state.data, selectedSubjectId) : undefined));
  const pageTitle = selectedSubject && activePage === 'subjects' ? selectedSubject.shortName : mobileNavItems.find((item) => item.page === activePage)?.label ?? 'ORBIT';
  return (
    <main className="min-h-screen w-full pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:hidden">
      <MobileTopBar
        title={pageTitle}
        showBack={!!selectedSubject && activePage === 'subjects'}
        onBack={() => setSelectedSubjectId(undefined)}
        onSearch={() => setSearchOpen(true)}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <div className="space-y-4 px-4 pb-4 pt-3">
        <AnimatePresence mode="wait">
          <motion.div key={`${activePage}-${selectedSubjectId ?? 'list'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {activePage === 'overview' && <MobileHome onQuickAdd={() => setQuickAddOpen(true)} />}
            {activePage === 'subjects' && (selectedSubject ? <MobileSubjectDetail subject={selectedSubject} /> : <MobileSubjects onSelect={setSelectedSubjectId} />)}
            {activePage === 'today' && <MobileToday onQuickAdd={() => setQuickAddOpen(true)} />}
            {activePage === 'revision' && <MobileRevision />}
            {activePage === 'notes' && <MobileNotes />}
            {activePage === 'history' && <HistoryPage />}
            {activePage === 'settings' && <MobileProfile />}
            {['practice', 'analytics'].includes(activePage) && <MobileSubjects onSelect={setSelectedSubjectId} />}
          </motion.div>
        </AnimatePresence>
      </div>
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </main>
  );
}

function MobileTopBar({ title, showBack, onBack, onSearch, onQuickAdd }: { title: string; showBack: boolean; onBack: () => void; onSearch: () => void; onQuickAdd: () => void }) {
  const activePage = useOrbitStore((state) => state.activePage);
  const quickAddPages: AppPage[] = ['overview', 'today', 'subjects', 'notes'];
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="flex min-h-11 items-center gap-2">
        {showBack ? (
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)]" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <CircleDot size={18} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">ORBIT</div>
          <h1 className="truncate text-lg font-semibold">{title}</h1>
        </div>
        <button type="button" onClick={onSearch} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)]" aria-label="Search">
          <Search size={18} />
        </button>
        {quickAddPages.includes(activePage) && (
          <button type="button" onClick={onQuickAdd} className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)] text-white" aria-label="Quick add">
            <Plus size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

function MobileHome({ onQuickAdd }: { onQuickAdd: () => void }) {
  const data = useOrbitStore((state) => state.data);
  const setPage = useOrbitStore((state) => state.setPage);
  const setSubject = useOrbitStore((state) => state.setSubject);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const recommendation = recommendedNextTask(data, data.preferences.focusModeSubjectId);
  const recommendedSubject = findSubject(data, recommendation.subjectId);
  const recommendedTopic = findTopic(data, recommendation.topicId)?.topic;
  const tasks = todaysTasks(data);
  const urgentRevisions = data.revisions.filter((revision) => ['due', 'overdue'].includes(revisionStatus(revision))).slice(0, 2);
  const subjects = activeSubjects(data);
  const activeTopic = subjects.flatMap((subject) => subject.modules.flatMap((module) => module.topics.map((topic) => ({ subject, topic })))).find(({ topic }) => topic.state === 'learning' || topic.state === 'practising');
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm text-[var(--muted)]">Good morning</div>
        <h2 className="mt-1 text-xl font-semibold">Let&apos;s make one clear move.</h2>
      </section>
      <section className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Next task</div>
            <h3 className="mt-2 text-lg font-semibold">{recommendation.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{recommendedSubject?.shortName ?? 'No subject'}{recommendedTopic ? ` · ${recommendedTopic.title}` : ''}</p>
          </div>
          <span className="rounded-xl border border-[var(--border)] px-2 py-1 text-xs">{recommendation.estimatedMinutes}m</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
          <div>{recommendation.actionType}</div>
          <div className="text-right">{recommendation.reason}</div>
        </div>
        <button type="button" onClick={() => startFocus(tasks.find((task) => task.title === recommendation.title)?.id)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white">
          <Play size={16} /> Start
        </button>
      </section>
      <div className="grid grid-cols-[116px_1fr] gap-3">
        <MobileProgressOrb value={semesterProgress(data)} label="Semester" />
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Continue learning</div>
          {activeTopic ? (
            <button type="button" onClick={() => setTopic(activeTopic.topic.id)} className="mt-3 w-full text-left">
              <div className="text-sm font-semibold">{activeTopic.topic.title}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{activeTopic.subject.shortName} · {topicCompletion(activeTopic.topic)}% complete</div>
            </button>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Start a topic to create your learning trail.</p>
          )}
        </section>
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Today's tasks" action="Add" onAction={onQuickAdd} />
        <div className="space-y-2">
          {tasks.slice(0, 4).map((task) => <MobileTaskCard key={task.id} task={task} />)}
          {!tasks.length && <EmptyState title="No tasks for today" body="Quick Add can create your first real task." />}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Revision due" action="View all" onAction={() => setPage('revision')} />
        <div className="space-y-2">
          {urgentRevisions.map((revision) => {
            const found = findTopic(data, revision.topicId);
            return <MobileRevisionCard key={revision.id} revisionId={revision.id} title={found?.topic.title ?? 'Topic'} subject={found?.subject.shortName ?? 'Subject'} status={revisionStatus(revision)} dueDate={revision.dueDate} confidence={found?.topic.confidence ?? 1} />;
          })}
          {!urgentRevisions.length && <EmptyState title="No urgent revision" body="Completed topics will schedule revision automatically." />}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Subject progress" />
        <div className="space-y-3">
          {subjects.map((subject) => {
            const progress = subjectProgress(subject);
            return (
              <button key={subject.id} type="button" onClick={() => { setSubject(subject.id); }} className="w-full text-left">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: subject.accent }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{subject.name}</div>
                    <div className="text-xs text-[var(--muted)]">{progress.completed}/{progress.total} topics · {progress.currentModule}</div>
                  </div>
                  <span className="text-sm font-semibold">{progress.percentage}%</span>
                </div>
                <ProgressBar value={progress.percentage} className="mt-2" />
              </button>
            );
          })}
          {!subjects.length && <EmptyState title="No subjects yet" body="Open Profile to build or import a semester." />}
        </div>
      </section>
    </div>
  );
}

function MobileSubjects({ onSelect }: { onSelect: (subjectId: string) => void }) {
  const data = useOrbitStore((state) => state.data);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'Active' | 'Needs attention' | 'Completed' | 'All'>('Active');
  const subjects = activeSubjects(data).filter((subject) => {
    const progress = subjectProgress(subject);
    const matchesSearch = `${subject.name} ${subject.code}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'All' || (filter === 'Completed' && progress.percentage === 100) || (filter === 'Needs attention' && (progress.percentage < 25 || averageConfidence(subject) <= 2.2)) || (filter === 'Active' && progress.percentage < 100);
    return matchesSearch && matchesFilter;
  });
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <Search size={17} className="text-[var(--muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
        {(['Active', 'Needs attention', 'Completed', 'All'] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs ${filter === item ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{item}</button>)}
      </div>
      <div className="space-y-3">
        {subjects.map((subject) => {
          const progress = subjectProgress(subject);
          const nextTopic = subject.modules.flatMap((module) => module.topics).find((topic) => topic.state !== 'completed');
          return (
            <button key={subject.id} type="button" onClick={() => onSelect(subject.id)} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left active:border-[var(--accent)]/40">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-3 w-3 rounded-full" style={{ background: subject.accent }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate font-semibold">{subject.name}</h2>
                    <span className="text-sm font-semibold">{progress.percentage}%</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{subject.code} · {progress.currentModule}</div>
                  <ProgressBar value={progress.percentage} className="mt-3" />
                  <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
                    <span>{progress.completed}/{progress.total} topics completed</span>
                    <span>Next: {nextTopic?.title ?? 'No open topics'}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="mt-1 text-[var(--muted)]" />
              </div>
            </button>
          );
        })}
        {!subjects.length && <EmptyState title="No matching subjects" body="Adjust the filter or add a subject from Profile." />}
      </div>
    </div>
  );
}

function MobileSubjectDetail({ subject }: { subject: Subject }) {
  const [tab, setTab] = useState<'Roadmap' | 'Modules' | 'Practice' | 'Notes' | 'Revision'>('Roadmap');
  const progress = subjectProgress(subject);
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{subject.code}</div>
            <h2 className="mt-1 truncate text-xl font-semibold">{subject.name}</h2>
          </div>
          <MobileProgressOrb value={progress.percentage} label="Done" compact />
        </div>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
        {(['Roadmap', 'Modules', 'Practice', 'Notes', 'Revision'] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-11 whitespace-nowrap rounded-xl border px-4 text-sm ${tab === item ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{item}</button>)}
      </div>
      {tab === 'Roadmap' && <MobileRoadmap subject={subject} />}
      {tab === 'Modules' && <MobileModuleView subject={subject} />}
      {tab === 'Practice' && <PracticePage subjectFilter={subject.id} />}
      {tab === 'Notes' && <MobileNotes subjectFilter={subject.id} />}
      {tab === 'Revision' && <MobileRevision subjectFilter={subject.id} />}
    </div>
  );
}

function MobileRoadmap({ subject }: { subject: Subject }) {
  const data = useOrbitStore((state) => state.data);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const topics = subject.modules.flatMap((module) => module.topics.map((topic) => ({ module, topic })));
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <MobileSectionHeader title="Roadmap" />
      <div className="relative space-y-3 before:absolute before:bottom-6 before:left-4 before:top-6 before:w-px before:bg-[var(--border)]">
        {topics.map(({ module, topic }, index) => (
          <button key={topic.id} type="button" onClick={() => setTopic(topic.id)} className="relative flex w-full gap-3 text-left">
            <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] text-xs">{index + 1}</span>
            <div className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white/[0.025] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{topic.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{module.title} · Confidence {topic.confidence}/5</div>
                </div>
                <StateBadge state={topic.state} />
              </div>
              <div className="mt-3 text-xs text-[var(--muted)]">{topic.checkpoints.filter((item) => item.completed).length}/5 checkpoints · {data.revisions.find((revision) => revision.topicId === topic.id && !revision.completedAt)?.dueDate ?? 'No revision set'}</div>
              <ProgressBar value={topicCompletion(topic)} className="mt-2" />
            </div>
          </button>
        ))}
        {!topics.length && <EmptyState title="No topics" body="Add modules and topics to create a learning journey." />}
      </div>
    </section>
  );
}

function MobileModuleView({ subject }: { subject: Subject }) {
  const setTopic = useOrbitStore((state) => state.setTopic);
  return (
    <div className="space-y-3">
      {subject.modules.map((module) => {
        const completion = Math.round(module.topics.reduce((sum, topic) => sum + topicCompletion(topic), 0) / Math.max(module.topics.length, 1));
        const remaining = module.topics.filter((topic) => topic.state !== 'completed').reduce((sum, topic) => sum + topic.estimatedMinutes, 0);
        return (
          <details key={module.id} open className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <summary className="min-h-14 cursor-pointer p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{module.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{module.topics.length} topics · {remaining}m remaining</div>
                </div>
                <span className="text-sm font-semibold">{completion}%</span>
              </div>
            </summary>
            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {module.topics.map((topic) => (
                <button key={topic.id} type="button" onClick={() => setTopic(topic.id)} className="flex min-h-14 w-full items-center gap-3 p-4 text-left">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg border ${topic.state === 'completed' ? 'border-[var(--success)] bg-[var(--success)] text-black' : 'border-[var(--border)] text-[var(--muted)]'}`}>{topic.state === 'completed' ? <Check size={14} /> : <BookOpen size={14} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{topic.title}</div>
                    <div className="text-xs text-[var(--muted)]">{topic.checkpoints.filter((item) => item.completed).length}/5 · Confidence {topic.confidence}/5</div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--muted)]" />
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function MobileToday({ onQuickAdd }: { onQuickAdd: () => void }) {
  const data = useOrbitStore((state) => state.data);
  const tasks = todaysTasks(data);
  const openTasks = tasks.filter((task) => !task.completed);
  const doneTasks = tasks.filter((task) => task.completed);
  const goal = recommendedNextTask(data, data.preferences.focusModeSubjectId);
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Primary goal" />
        <h2 className="text-lg font-semibold">{goal.title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{goal.reason}</p>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Task list" action="Quick add" onAction={onQuickAdd} />
        <div className="space-y-2">
          {openTasks.map((task) => <MobileTaskCard key={task.id} task={task} />)}
          {!openTasks.length && <EmptyState title="No open tasks" body="Create a task or start the recommended next move." />}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Completed today" />
        <div className="space-y-2">
          {doneTasks.map((task) => <MobileTaskCard key={task.id} task={task} />)}
          {!doneTasks.length && <EmptyState title="Nothing completed yet" body="A completed task will appear here immediately." />}
        </div>
      </section>
    </div>
  );
}

function MobileRevision({ subjectFilter }: { subjectFilter?: string }) {
  const data = useOrbitStore((state) => state.data);
  const revisions = data.revisions.filter((revision) => !subjectFilter || revision.subjectId === subjectFilter);
  const sections = [
    { title: 'Due today', status: 'due' },
    { title: 'Overdue', status: 'overdue' },
    { title: 'Upcoming', status: 'upcoming' },
  ] as const;
  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const items = revisions.filter((revision) => revisionStatus(revision) === section.status);
        return (
          <section key={section.status} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <MobileSectionHeader title={section.title} />
            <div className="space-y-2">
              {items.map((revision) => {
                const found = findTopic(data, revision.topicId);
                return <MobileRevisionCard key={revision.id} revisionId={revision.id} title={found?.topic.title ?? 'Topic'} subject={found?.subject.shortName ?? 'Subject'} status={section.status} dueDate={revision.dueDate} confidence={found?.topic.confidence ?? 1} />;
              })}
              {!items.length && <EmptyState title="Nothing here" body="Revision cards appear after topics are completed." />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MobileNotes({ subjectFilter }: { subjectFilter?: string }) {
  const data = useOrbitStore((state) => state.data);
  const addNote = useOrbitStore((state) => state.addNote);
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);
  const [confusing, setConfusing] = useState(false);
  const notes = data.notes.filter((note) => (!subjectFilter || note.subjectId === subjectFilter) && `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <Search size={17} className="text-[var(--muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button type="button" onClick={() => setEditorOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent)] text-white"><Plus size={17} /></button>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Important notes" />
        <div className="space-y-2">
          {notes.filter((note) => note.important).slice(0, 4).map((note) => <NoteCard key={note.id} note={note} />)}
          {!notes.some((note) => note.important) && <EmptyState title="No important notes" body="Mark notes important when saving them." />}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Recent notes" />
        <div className="space-y-2">
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
          {!notes.length && <EmptyState title="No notes yet" body="Use the full-screen editor to save text, code snippets and links." />}
        </div>
      </section>
      <AnimatePresence>
        {editorOpen && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-0 z-[65] bg-[var(--bg)] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="flex min-h-11 items-center gap-3">
              <button onClick={() => setEditorOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)]"><ArrowLeft size={18} /></button>
              <h2 className="flex-1 text-lg font-semibold">Note editor</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="min-h-12 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm" />
              <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Text, code blocks, resource links..." className="min-h-[48vh] resize-none rounded-2xl border border-[var(--border)] bg-transparent p-4 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setImportant(!important)} className={`min-h-11 rounded-xl border text-sm ${important ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>Important</button>
                <button onClick={() => setConfusing(!confusing)} className={`min-h-11 rounded-xl border text-sm ${confusing ? 'border-[var(--warning)] bg-[rgba(215,174,104,0.12)] text-[var(--warning)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>Confusing</button>
              </div>
              <button disabled={!body.trim()} onClick={() => { const subjectId = subjectFilter ?? activeSubjects(data)[0]?.id; if (!subjectId) return; addNote({ title: title.trim() || 'Untitled note', body, subjectId, important, confusing }); setTitle(''); setBody(''); setImportant(false); setConfusing(false); setEditorOpen(false); }} className="min-h-12 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-50">Save note</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileProfile() {
  const data = useOrbitStore((state) => state.data);
  const setPage = useOrbitStore((state) => state.setPage);
  const updatePreferences = useOrbitStore((state) => state.updatePreferences);
  const resetProgress = useOrbitStore((state) => state.resetProgress);
  const importData = useOrbitStore((state) => state.importData);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
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
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]">A</div>
          <div>
            <h2 className="font-semibold">{data.semester.title}</h2>
            <p className="text-sm text-[var(--muted)]">{data.semester.program}</p>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Study preference" />
        <div className="grid gap-2">
          {(['One topic at a time', 'Daily balanced plan', 'Exam sprint', 'Project-focused'] as const).map((style) => <button key={style} onClick={() => updatePreferences({ workStyle: style })} className={`min-h-11 rounded-xl border px-3 text-left text-sm ${data.preferences.workStyle === style ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)]'}`}>{style}</button>)}
        </div>
      </section>
      <section id="mobile-semester-settings" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Daily availability" />
        <div className="grid grid-cols-2 gap-2">
          {(['30 minutes', '1 hour', '2 hours', 'Flexible'] as const).map((time) => <button key={time} onClick={() => updatePreferences({ dailyTime: time })} className={`min-h-11 rounded-xl border px-3 text-sm ${data.preferences.dailyTime === time ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)]'}`}>{time}</button>)}
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <MobileSectionHeader title="Settings" />
        <div className="grid gap-2">
          <button onClick={() => updatePreferences({ theme: data.preferences.theme === 'dark' ? 'light' : 'dark' })} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Moon size={16} /> Theme: {data.preferences.theme}</button>
          <button onClick={() => setPage('notes')} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><NotebookPen size={16} /> Notes</button>
          <button onClick={() => setPage('history')} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Timer size={16} /> Study history</button>
          <button onClick={exportData} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Download size={16} /> Export data</button>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Import size={16} /> Import data<input type="file" accept="application/json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (!confirm('Importing JSON will replace current ORBIT data. Continue?')) { event.target.value = ''; return; } try { importData(JSON.parse(await file.text()) as OrbitData); } catch { alert('That JSON file could not be read safely.'); } }} /></label>
          <button onClick={() => document.getElementById('mobile-semester-settings')?.scrollIntoView({ behavior: 'smooth' })} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><SlidersHorizontal size={16} /> Semester settings</button>
          <button onClick={() => installPrompt && 'prompt' in installPrompt && (installPrompt as { prompt: () => Promise<void> }).prompt()} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><Smartphone size={16} /> Install app</button>
          <button onClick={() => confirm('Reset all local ORBIT data?') && resetProgress()} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--danger)]/35 px-3 text-sm text-[var(--danger)]"><RotateCcw size={16} /> Reset progress</button>
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
        <MobileSectionHeader title="About ORBIT" />
        ORBIT is a local-first academic tracker. Your subjects, tasks, revisions, notes and sessions stay synchronized through the shared browser storage used by desktop and mobile.
      </section>
    </div>
  );
}

function MobileTaskCard({ task }: { task: StudyTask }) {
  const data = useOrbitStore((state) => state.data);
  const toggleTask = useOrbitStore((state) => state.toggleTask);
  const rescheduleTask = useOrbitStore((state) => state.rescheduleTask);
  const setTopic = useOrbitStore((state) => state.setTopic);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const subject = findSubject(data, task.subjectId);
  const topic = findTopic(data, task.topicId)?.topic;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <motion.article drag="x" dragConstraints={{ left: -64, right: 64 }} onDragEnd={(_, info) => { if (info.offset.x > 56) toggleTask(task.id); if (info.offset.x < -56) rescheduleTask(task.id, tomorrow); }} className="rounded-2xl border border-[var(--border)] bg-white/[0.025] p-3">
      <div className="flex items-start gap-3">
        <button onClick={() => toggleTask(task.id)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition ${task.completed ? 'border-[var(--success)] bg-[var(--success)] text-black' : 'border-[var(--border)]'}`} aria-label="Complete task">{task.completed && <Check size={15} />}</button>
        <button onClick={() => task.topicId && setTopic(task.topicId)} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-semibold">{task.title}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{subject?.shortName ?? 'Subject'}{topic ? ` · ${topic.title}` : ''}</div>
          <div className="mt-2 flex gap-2 text-[11px] text-[var(--muted)]"><span>{task.actionType}</span><span>{task.estimatedMinutes}m</span><span>{task.priority}</span></div>
        </button>
        <details className="relative">
          <summary className="grid h-8 w-8 list-none place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)]"><Menu size={15} /></summary>
          <div className="absolute right-0 top-10 z-10 grid w-40 gap-1 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-2 shadow-soft">
            <button onClick={() => startFocus(task.id)} className="rounded-lg px-2 py-2 text-left text-xs hover:bg-white/[0.05]">Start focus</button>
            <button onClick={() => toggleTask(task.id)} className="rounded-lg px-2 py-2 text-left text-xs hover:bg-white/[0.05]">Complete</button>
            <button onClick={() => rescheduleTask(task.id, tomorrow)} className="rounded-lg px-2 py-2 text-left text-xs hover:bg-white/[0.05]">Tomorrow</button>
          </div>
        </details>
      </div>
    </motion.article>
  );
}

function MobileRevisionCard({ revisionId, title, subject, status, dueDate, confidence }: { revisionId: string; title: string; subject: string; status: string; dueDate: string; confidence: number }) {
  const completeRevision = useOrbitStore((state) => state.completeRevision);
  const [nextConfidence, setNextConfidence] = useState(confidence);
  const dueText = status === 'overdue' ? `Overdue since ${dueDate}` : status === 'due' ? 'Due today' : `Due ${dueDate}`;
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{subject} · Previous confidence {confidence}/5</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{dueText}</div>
        </div>
        <span className={`rounded-lg px-2 py-1 text-[10px] ${status === 'overdue' ? 'bg-[rgba(224,130,130,0.12)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>{status}</span>
      </div>
      {status !== 'completed' && (
        <div className="mt-3 flex items-center gap-2">
          <input type="range" min={1} max={5} value={nextConfidence} onChange={(event) => setNextConfidence(Number(event.target.value))} className="min-w-0 flex-1 accent-[var(--accent)]" />
          <button onClick={() => completeRevision(revisionId, nextConfidence)} className="min-h-10 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-white">Revise</button>
        </div>
      )}
    </article>
  );
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useOrbitStore((state) => state.data);
  const addTask = useOrbitStore((state) => state.addTask);
  const addCustomTopic = useOrbitStore((state) => state.addCustomTopic);
  const addCustomSubject = useOrbitStore((state) => state.addCustomSubject);
  const addNote = useOrbitStore((state) => state.addNote);
  const [kind, setKind] = useState<'Study task' | 'Topic' | 'Note' | 'Revision' | 'Custom subject'>('Study task');
  const subjects = activeSubjects(data);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const subject = findSubject(data, subjectId) ?? subjects[0];
  const topics = subject?.modules.flatMap((module) => module.topics) ?? [];
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(25);
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjectId, subjects]);
  const save = () => {
    if (kind === 'Custom subject') {
      addCustomSubject(title);
    } else if (kind === 'Topic' && subject) {
      addCustomTopic(subject.id, title);
    } else if (kind === 'Note' && subject) {
      addNote({ title: title || 'Quick note', body: title, subjectId: subject.id, topicId: topicId || undefined, important: false, confusing: false });
    } else if (subject) {
      addTask({ subjectId: subject.id, topicId: topicId || undefined, title: title || `${kind} ${topics.find((topic) => topic.id === topicId)?.title ?? subject.shortName}`, actionType: kind === 'Revision' ? 'Revise' : 'Learn', estimatedMinutes: duration, priority, scheduledFor: date });
    }
    setTitle('');
    onClose();
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] bg-black/45 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.section initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quick Add</h2>
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)]"><X size={17} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['Study task', 'Topic', 'Note', 'Revision', 'Custom subject'] as const).map((item) => <button key={item} onClick={() => setKind(item)} className={`min-h-11 rounded-xl border px-3 text-left text-sm ${kind === item ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{item}</button>)}
            </div>
            <div className="mt-4 grid gap-3">
              {kind !== 'Custom subject' && (
                <select value={subject?.id ?? ''} onChange={(event) => { setSubjectId(event.target.value); setTopicId(''); }} className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                  {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              )}
              {['Study task', 'Note', 'Revision'].includes(kind) && (
                <select value={topicId} onChange={(event) => setTopicId(event.target.value)} className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                  <option value="">No topic selected</option>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                </select>
              )}
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'Custom subject' ? 'Subject name' : kind === 'Topic' ? 'Topic title' : 'Task, note or revision title'} className="min-h-12 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm" />
              {['Study task', 'Revision'].includes(kind) && (
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min={5} value={duration} onChange={(event) => setDuration(Number(event.target.value) || 25)} className="min-h-12 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm" aria-label="Duration" />
                  <select value={priority} onChange={(event) => setPriority(event.target.value as 'Low' | 'Medium' | 'High')} className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option>Low</option><option>Medium</option><option>High</option></select>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-h-12 rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm" />
                </div>
              )}
              <button disabled={!title.trim() && kind !== 'Study task'} onClick={save} className="min-h-12 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-50">Save</button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MobileProgressOrb({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  const size = compact ? 'h-16 w-16' : 'h-[116px] w-[116px]';
  return (
    <div className={`grid ${size} place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]`} style={{ backgroundImage: `conic-gradient(var(--accent) ${value}%, transparent 0)` }}>
      <div className={`grid ${compact ? 'h-12 w-12' : 'h-24 w-24'} place-items-center rounded-full bg-[var(--surface)] text-center`}>
        <div>
          <div className={compact ? 'text-lg font-semibold' : 'text-2xl font-semibold'}>{value}%</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function MobileSectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</h2>{action && <button type="button" onClick={onAction} className="min-h-8 rounded-lg px-2 text-xs text-[var(--accent)]">{action}</button>}</div>;
}

function MobileNav() {
  const activePage = useOrbitStore((state) => state.activePage);
  const setPage = useOrbitStore((state) => state.setPage);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_93%,transparent)] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const active = activePage === item.page;
        return (
          <button key={item.page} type="button" onClick={() => setPage(item.page)} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] transition ${active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] active:bg-white/[0.04]'}`}>
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
  const recommendation = recommendedNextTask(data, data.preferences.focusModeSubjectId);
  const focusSubject = findSubject(data, recommendation.subjectId) ?? activeSubjects(data)[0];
  const topic = findTopic(data, recommendation.topicId)?.topic;
  const subjectRows = activeSubjects(data).map((subject) => ({ subject, ...subjectProgress(subject) }));
  const revisions = data.revisions.filter((revision) => ['due', 'overdue'].includes(revisionStatus(revision))).slice(0, 4);
  const activity = weeklyActivity(data);
  const hasActivity = activity.some((day) => day.minutes > 0 || day.topics > 0 || day.questions > 0);
  const momentum = getMomentumLines(data);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--accent)]">
              <GraduationCap size={14} />
              {data.semester.title} control room
            </div>
            <h2 className="max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Good evening. Your next best move is clear.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">ORBIT is calculating your next action from revisions, planned work, topic state and confidence.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Recommended next task</div>
                <div className="mt-2 text-lg font-semibold">{recommendation.title}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">{focusSubject?.name ?? 'No active subject'}{topic ? ` -> ${topic.title}` : ''}</div>
                <div className="mt-2 text-xs text-[var(--muted)]">{recommendation.reason}</div>
              </div>
              <button type="button" onClick={() => startFocus(tasks.find((task) => task.title === recommendation.title)?.id)} className="rounded-2xl bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-white transition hover:brightness-110">Continue learning</button>
            </div>
          </div>
          <OrbitVisual subjects={subjectRows.map((row) => row.subject)} progress={progress} />
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Today's Plan" action="Drag to reorder" />
        <TaskList tasks={tasks.slice(0, 4)} />
      </section>

      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Subject Progress" action="Open roadmap" />
        <div className="space-y-3">
          {subjectRows.length ? subjectRows.map((row) => (
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
          )) : <EmptyState title="No subjects yet" body="Use the onboarding setup or Settings to add your semester syllabus." />}
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
            {!hasActivity ? <EmptyState title="No study activity yet" body="Complete a focus session or task to start your weekly graph." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activity}>
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
            )}
          </div>
        </section>
        <section className="panel p-5 sm:p-6">
          <SectionHeader title="Current Momentum" />
          <div className="grid gap-3 text-sm text-[var(--muted)]">
            {momentum.length ? momentum.map((line) => <MomentumLine key={line} text={line} />) : <EmptyState title="Your streak begins today" body="No achievements are shown until you create real study history." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function OrbitVisual({ subjects, progress }: { subjects: Subject[]; progress: number }) {
  const visibleSubjects = subjects.length ? subjects : [{ id: 'empty', name: 'Add subjects', shortName: 'Start', code: '', credits: 0, accent: '#A78BFA', modules: [], totalStudyHours: 0, assessmentReadiness: 0 }];
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
      {visibleSubjects.map((subject, index) => {
        const angle = (index / visibleSubjects.length) * Math.PI * 2 - Math.PI / 2;
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
  const subject = findSubject(data, activeSubjectId) ?? activeSubjects(data)[0];
  const [tab, setTab] = useState('Roadmap');
  if (!subject) return <EmptySemester />;
  const progress = subjectProgress(subject);
  const tabs = ['Roadmap', 'Modules', 'Practice', 'Notes', 'Revision', 'Analytics'];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {activeSubjects(data).map((item) => <button key={item.id} onClick={() => setSubject(item.id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs ${item.id === subject.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{item.shortName}</button>)}
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
            <Metric label="Study hours" value={`${Math.round(data.sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0) / 60)}h`} />
            <Metric label="Topics done" value={`${progress.completed}/${progress.total}`} />
            <Metric label="Readiness" value={`${Math.round((progress.percentage + averageConfidence(subject) * 20) / 2)}%`} />
          </div>
        </div>
        <div className="mt-6">
          <ProgressBar value={progress.percentage} />
          <div className="mt-2 text-xs text-[var(--muted)]">Current module: {progress.currentModule}</div>
        </div>
      </section>
      <SubjectManager subject={subject} />
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

function EmptySemester() {
  const setPage = useOrbitStore((state) => state.setPage);
  return (
    <section className="panel p-8 text-center">
      <h2 className="font-serif text-4xl">Build your semester structure</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Add subjects manually, use the B.Tech template, or import a syllabus before tracking progress.</p>
      <button onClick={() => setPage('settings')} className="mt-5 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Open setup</button>
    </section>
  );
}

function SubjectManager({ subject }: { subject: Subject }) {
  const updateSubject = useOrbitStore((state) => state.updateSubject);
  const duplicateSubject = useOrbitStore((state) => state.duplicateSubject);
  const archiveSubject = useOrbitStore((state) => state.archiveSubject);
  const deleteCustomSubject = useOrbitStore((state) => state.deleteCustomSubject);
  const [title, setTitle] = useState(subject.name);
  const [code, setCode] = useState(subject.code);
  const [credits, setCredits] = useState(String(subject.credits));

  useEffect(() => {
    setTitle(subject.name);
    setCode(subject.code);
    setCredits(String(subject.credits));
  }, [subject]);

  return (
    <section className="panel grid gap-3 p-4 md:grid-cols-[1fr_130px_90px_auto]">
      <input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => title.trim() && updateSubject(subject.id, { name: title.trim() })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" aria-label="Subject title" />
      <input value={code} onChange={(event) => setCode(event.target.value)} onBlur={() => updateSubject(subject.id, { code: code.trim() || 'CUSTOM' })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" aria-label="Subject code" />
      <input value={credits} type="number" min={0} onChange={(event) => setCredits(event.target.value)} onBlur={() => updateSubject(subject.id, { credits: Number(credits) || 0 })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" aria-label="Credits" />
      <div className="flex gap-2">
        <button onClick={() => duplicateSubject(subject.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)]" aria-label="Duplicate subject"><Copy size={16} /></button>
        <button onClick={() => archiveSubject(subject.id)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Archive</button>
        {subject.custom && <button onClick={() => deleteCustomSubject(subject.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--danger)]/40 text-[var(--danger)]" aria-label="Delete custom subject"><Trash2 size={16} /></button>}
      </div>
    </section>
  );
}

function ModuleView({ subject }: { subject: Subject }) {
  const setTopic = useOrbitStore((state) => state.setTopic);
  const addCustomTopic = useOrbitStore((state) => state.addCustomTopic);
  const addModule = useOrbitStore((state) => state.addModule);
  const [newTopic, setNewTopic] = useState('');
  const [newModule, setNewModule] = useState('');
  return (
    <section className="space-y-4">
      <div className="panel grid gap-3 p-4 lg:grid-cols-[1fr_auto_1fr_auto]">
        <input value={newModule} onChange={(event) => setNewModule(event.target.value)} placeholder="Add module" className="min-w-0 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
        <button type="button" onClick={() => { addModule(subject.id, newModule); setNewModule(''); }} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Add module</button>
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
          <button type="button" onClick={() => { const subject = activeSubjects(data)[0]; if (!subject || !capture.trim()) return; addTask({ subjectId: subject.id, title: capture.trim(), actionType: 'Learn', estimatedMinutes: 25, priority: 'Medium', scheduledFor: new Date().toISOString().slice(0, 10) }); setCapture(''); }} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!capture.trim() || !activeSubjects(data).length}>Capture</button>
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
  const topics = activeSubjects(data).filter((subject) => !subjectFilter || subject.id === subjectFilter).flatMap((subject) => subject.modules.flatMap((module) => module.topics.map((topic) => ({ subject, module, topic })))).filter(({ topic }) => topic.state !== 'completed');
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
  const subjects = activeSubjects(data);
  const subjectData = subjects.map((subject) => ({ name: subject.shortName, progress: subjectProgress(subject).percentage, hours: Math.round(data.sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0) / 60), color: subject.accent }));
  const states = ['not-started', 'learning', 'practising', 'completed'].map((state) => ({ name: stateLabels[state as LearningState], value: subjects.flatMap((subject) => subject.modules.flatMap((module) => module.topics)).filter((topic) => topic.state === state).length }));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Subject-wise completion" />
        <div className="h-72">{subjectData.length ? <ResponsiveContainer><BarChart data={subjectData}><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 12 }} /><Bar dataKey="progress" radius={[8, 8, 0, 0]}>{subjectData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyState title="No analytics yet" body="Add subjects and complete study actions to generate analytics." />}</div>
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
        <button type="button" onClick={() => { const subjectId = subjectFilter ?? activeSubjects(data)[0]?.id; if (!subjectId || !body.trim()) return; addNote({ title: query || 'Untitled note', body, subjectId, important: false, confusing: false }); setBody(''); }} className="mt-3 w-full rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!body.trim() || !activeSubjects(data).length}>Save note</button>
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
  const restoreBackup = useOrbitStore((state) => state.restoreBackup);
  const addCustomSubject = useOrbitStore((state) => state.addCustomSubject);
  const updatePreferences = useOrbitStore((state) => state.updatePreferences);
  const applyTemplate = useOrbitStore((state) => state.useTemplate);
  const createSemester = useOrbitStore((state) => state.createSemester);
  const [subjectName, setSubjectName] = useState('');
  const [semesterTitle, setSemesterTitle] = useState(data.semester.title);
  const [program, setProgram] = useState(data.semester.program);
  const [backups, setBackups] = useState(() => listOrbitBackups());
  useEffect(() => {
    setBackups(listOrbitBackups());
  }, [data]);
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
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm"><Import size={16} /> Import JSON<input type="file" accept="application/json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (!confirm('Importing JSON will replace current ORBIT data. Continue?')) { event.target.value = ''; return; } try { importData(JSON.parse(await file.text()) as OrbitData); alert('JSON import completed.'); } catch { alert('That JSON file could not be read safely.'); } }} /></label>
          <button type="button" onClick={() => confirm('Reset all local ORBIT data?') && resetProgress()} className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/35 p-3 text-left text-sm text-[var(--danger)]"><RotateCcw size={16} /> Reset progress</button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Restore backup" action={`${backups.length} saved`} />
        <div className="grid gap-2">
          {backups.map((backup) => (
            <div key={backup.key} className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <div className="font-medium">{new Date(backup.timestamp).toLocaleString()}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{backup.reason}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { restoreBackup(backup.key); setBackups(listOrbitBackups()); }} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">Restore</button>
                <button type="button" onClick={() => downloadJson(backup.data, `orbit-backup-${backup.timestamp}.json`)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs">Download</button>
              </div>
            </div>
          ))}
          {!backups.length && <EmptyState title="No backups yet" body="ORBIT creates backups before imports, migration, restore and replacement." />}
        </div>
      </section>
      <section className="panel p-5 sm:p-6">
        <SectionHeader title="Semester structure" />
        <div className="grid gap-2">
          <input value={semesterTitle} onChange={(event) => setSemesterTitle(event.target.value)} placeholder="Semester title" className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
          <input value={program} onChange={(event) => setProgram(event.target.value)} placeholder="Program" className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => confirm('Create a new manual semester and clear current ORBIT data?') && createSemester(semesterTitle, program)} className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 text-sm">Build manually</button>
            <button type="button" onClick={() => confirm('Use the B.Tech template and clear current ORBIT data?') && applyTemplate(semesterTitle)} className="flex-1 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm text-[var(--accent)]">Use B.Tech template</button>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Add custom subject" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
          <button type="button" onClick={() => { addCustomSubject(subjectName); setSubjectName(''); }} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Add</button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6 xl:col-span-2">
        <SyllabusImportFlow
          mode="settings"
          preferences={data.preferences}
          onConfirm={(orbitData, importMode) => importData(orbitData, importMode)}
        />
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

function HistoryPage() {
  const data = useOrbitStore((state) => state.data);
  const records = [...(data.activity ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const groups = [
    { title: 'Today', items: records.filter((record) => record.timestamp.slice(0, 10) === todayIso) },
    { title: 'This week', items: records.filter((record) => record.timestamp.slice(0, 10) !== todayIso && record.timestamp.slice(0, 10) >= weekAgo) },
    { title: 'Earlier', items: records.filter((record) => record.timestamp.slice(0, 10) < weekAgo) },
  ];
  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group.title} className="panel p-5 sm:p-6">
          <SectionHeader title={group.title} action={`${group.items.length} records`} />
          <div className="grid gap-3">
            {group.items.map((record) => {
              const subject = record.subjectId ? findSubject(data, record.subjectId) : undefined;
              const found = findTopic(data, record.topicId);
              return (
                <article key={record.id} className="rounded-2xl border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--accent)]">{record.action.replaceAll('_', ' ')}</span>
                    <span>{subject?.shortName ?? found?.subject.shortName ?? 'ORBIT'}</span>
                    {found && <span className="text-[var(--muted)]">· {found.topic.title}</span>}
                    <span className="ml-auto text-xs text-[var(--muted)]">{new Date(record.timestamp).toLocaleString()}</span>
                  </div>
                  {record.metadata?.minutes !== undefined && <div className="mt-2 text-xs text-[var(--muted)]">Study duration: {String(record.metadata.minutes)} minutes</div>}
                </article>
              );
            })}
            {!group.items.length && <EmptyState title="No activity" body="Meaningful study actions will appear here." />}
          </div>
        </section>
      ))}
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
  const addSubtopic = useOrbitStore((state) => state.addSubtopic);
  const addNote = useOrbitStore((state) => state.addNote);
  const deleteCustomTopic = useOrbitStore((state) => state.deleteCustomTopic);
  const addTask = useOrbitStore((state) => state.addTask);
  const startFocus = useOrbitStore((state) => state.startFocus);
  const found = findTopic(data, topicId);
  const [resource, setResource] = useState('');
  const [question, setQuestion] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [personalNote, setPersonalNote] = useState('');

  return (
    <AnimatePresence>
      {found && (
        <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 240 }} className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-[var(--border)] bg-[var(--bg)] p-5 pb-[calc(6rem+env(safe-area-inset-bottom))] shadow-soft sm:max-w-xl md:pb-5">
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
            <input value={subtopic} onChange={(event) => setSubtopic(event.target.value)} placeholder="Add subtopic" className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
            <button onClick={() => { addSubtopic(found.topic.id, subtopic); setSubtopic(''); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Add subtopic</button>
            {!!found.topic.subtopics.length && <div className="rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--muted)]">{found.topic.subtopics.map((item) => item.title).join(', ')}</div>}
            <textarea value={personalNote} onChange={(event) => setPersonalNote(event.target.value)} placeholder="Add personal note..." className="min-h-24 resize-none rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm" />
            <button onClick={() => { addNote({ title: `${found.topic.title} note`, body: personalNote || 'Topic note', subjectId: found.subject.id, moduleId: found.module.id, topicId: found.topic.id, important: !!found.topic.important, confusing: !!found.topic.confusing }); setPersonalNote(''); }} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Save note</button>
            {found.topic.custom && <button onClick={() => deleteCustomTopic(found.topic.id)} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--danger)]/35 px-3 py-2 text-sm text-[var(--danger)]"><Trash2 size={15} /> Delete custom topic</button>}
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-2 gap-2 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:absolute md:hidden">
            <button onClick={() => { addTask({ subjectId: found.subject.id, topicId: found.topic.id, title: `Study ${found.topic.title}`, actionType: 'Learn', estimatedMinutes: found.topic.estimatedMinutes, priority: found.topic.confidence <= 2 ? 'High' : 'Medium', scheduledFor: new Date().toISOString().slice(0, 10) }); updateTopicState(found.topic.id, found.topic.state === 'not-started' ? 'learning' : found.topic.state); startFocus(); }} className="min-h-12 rounded-xl border border-[var(--border)] text-sm font-semibold">Start focus</button>
            <button onClick={() => updateTopicState(found.topic.id, 'completed')} className="min-h-12 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white">Complete topic</button>
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
  const toggleCheckpoint = useOrbitStore((state) => state.toggleCheckpoint);
  const task = data.tasks.find((item) => item.id === focusTaskId);
  const found = findTopic(data, task?.topicId);
  const [seconds, setSeconds] = useState(25 * 60);
  useEffect(() => {
    if (!focusTaskId) return;
    setSeconds((task?.estimatedMinutes ?? 25) * 60);
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [focusTaskId, task?.estimatedMinutes]);
  return (
    <AnimatePresence>
      {task && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--bg)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:grid md:place-items-center">
          <div className="mx-auto w-full max-w-3xl text-center">
            <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]"><Timer size={32} /></div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{found?.subject.name ?? 'Study session'} · {found?.topic.title ?? task.actionType}</div>
            <h2 className="mt-3 font-serif text-5xl">{task.title}</h2>
            <div className="my-10 text-7xl font-semibold tabular-nums">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</div>
            {found && (
              <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left">
                <div className="mb-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Checklist</div>
                <div className="grid gap-2">
                  {found.topic.checkpoints.map((checkpoint) => (
                    <button key={checkpoint.key} type="button" onClick={() => toggleCheckpoint(found.topic.id, checkpoint.key)} className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-left text-sm">
                      <span className={`grid h-6 w-6 place-items-center rounded-lg border ${checkpoint.completed ? 'border-[var(--success)] bg-[var(--success)] text-black' : 'border-[var(--border)]'}`}>{checkpoint.completed && <Check size={14} />}</span>
                      {checkpoint.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
  const applyTemplate = useOrbitStore((state) => state.useTemplate);
  const createSemester = useOrbitStore((state) => state.createSemester);
  const importData = useOrbitStore((state) => state.importData);
  const [semesterTitle, setSemesterTitle] = useState('Semester III');
  const [program, setProgram] = useState('B.Tech CSE AIML');
  const [workStyle, setWorkStyle] = useState<'One topic at a time' | 'Daily balanced plan' | 'Exam sprint' | 'Project-focused'>('Daily balanced plan');
  const [dailyTime, setDailyTime] = useState<'30 minutes' | '1 hour' | '2 hours' | 'Flexible'>('1 hour');
  const preferences = { theme: 'dark' as const, onboardingComplete: true, setupMethod: 'import' as const, workStyle, dailyTime };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--bg)] p-4 md:p-8">
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft md:p-7">
        <div className="mb-8 flex items-center justify-between">
          <div><div className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">First launch</div><h1 className="mt-1 text-2xl font-semibold">Import your semester into ORBIT</h1></div>
          <button onClick={() => completeOnboarding()} className="text-sm text-[var(--muted)]">Skip</button>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-4xl leading-tight">Upload a syllabus PDF. Review what ORBIT understood.</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">The generated semester is not saved until you confirm the preview. You can rename subjects, clean modules, edit topics, merge duplicates and add missing work first.</p>
          </div>
          <div className="grid gap-2">
            <select value={workStyle} onChange={(event) => setWorkStyle(event.target.value as typeof workStyle)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
              {(['One topic at a time', 'Daily balanced plan', 'Exam sprint', 'Project-focused'] as const).map((style) => <option key={style}>{style}</option>)}
            </select>
            <select value={dailyTime} onChange={(event) => setDailyTime(event.target.value as typeof dailyTime)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
              {(['30 minutes', '1 hour', '2 hours', 'Flexible'] as const).map((time) => <option key={time}>{time}</option>)}
            </select>
          </div>
        </div>
        <SyllabusImportFlow mode="onboarding" preferences={preferences} onConfirm={(orbitData, importMode) => importData(orbitData, importMode)} />
        <div className="mt-6 rounded-2xl border border-[var(--border)] p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Secondary setup options</div>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <input value={semesterTitle} onChange={(event) => setSemesterTitle(event.target.value)} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" placeholder="Semester title" />
            <input value={program} onChange={(event) => setProgram(event.target.value)} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" placeholder="Program" />
            <button onClick={() => { createSemester(semesterTitle, program); completeOnboarding({ setupMethod: 'manual', workStyle, dailyTime }); }} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">Build manually</button>
            <button onClick={() => { applyTemplate(semesterTitle); completeOnboarding({ setupMethod: 'template', workStyle, dailyTime }); }} className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm text-[var(--accent)]">Use template</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SyllabusImportFlow({ mode, preferences, onConfirm }: { mode: 'onboarding' | 'settings'; preferences: OrbitData['preferences']; onConfirm: (data: OrbitData, mode: ImportMode) => void }) {
  const [message, setMessage] = useState('Upload a PDF syllabus or paste syllabus text to generate a structured preview.');
  const [paste, setPaste] = useState('');
  const [draft, setDraft] = useState<ExtractedSyllabus>();
  const [loading, setLoading] = useState(false);
  const extractFile = async (file: File) => {
    setLoading(true);
    try {
      const result = await extractSyllabus(file);
      setDraft(result);
      setMessage(result.warnings.join(' '));
    } catch {
      setMessage('ORBIT could not extract this PDF. Try copying the syllabus text into the paste box.');
    } finally {
      setLoading(false);
    }
  };
  const extractText = async () => {
    if (!paste.trim()) return;
    setLoading(true);
    const result = await extractSyllabusText(paste);
    setDraft(result);
    setMessage(result.warnings.join(' '));
    setLoading(false);
  };
  return (
    <div className={mode === 'settings' ? '' : 'rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4'}>
      <SectionHeader title="AI syllabus ingestion" action={draft ? 'Review before import' : 'Rule-based provider'} />
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid content-start gap-3">
        <label className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
            Upload semester syllabus PDF
            <input type="file" accept="application/pdf" className="mt-3 block w-full text-sm" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await extractFile(file); }} />
        </label>
          <textarea value={paste} onChange={(event) => setPaste(event.target.value)} className="min-h-32 rounded-2xl border border-[var(--border)] bg-transparent p-4 text-sm" placeholder="Or paste plain-text syllabus here..." />
          <button onClick={extractText} disabled={!paste.trim() || loading} className="rounded-2xl bg-[var(--accent)] p-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Extracting...' : 'Extract syllabus text'}</button>
          <div className="rounded-2xl border border-[var(--warning)]/35 bg-[rgba(215,174,104,0.1)] p-3 text-sm text-[var(--warning)]">{message}</div>
        </div>
        {draft ? <SyllabusReview draft={draft} setDraft={setDraft} onConfirm={(importMode) => onConfirm(extractedToOrbitData(draft, preferences), importMode)} /> : <SyllabusPreviewEmpty />}
      </div>
    </div>
  );
}

function SyllabusPreviewEmpty() {
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles size={22} /></div>
        <h3 className="mt-4 text-lg font-semibold">Structured preview appears here</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">ORBIT will detect semester title, subject names, codes, credits, modules, topics and subtopics before anything is saved.</p>
      </div>
    </div>
  );
}

function SyllabusReview({ draft, setDraft, onConfirm }: { draft: ExtractedSyllabus; setDraft: (value: ExtractedSyllabus | ((current: ExtractedSyllabus | undefined) => ExtractedSyllabus | undefined)) => void; onConfirm: (mode: ImportMode) => void }) {
  const updateDraft = (recipe: (next: ExtractedSyllabus) => void) => {
    setDraft((current) => {
      if (!current) return current;
      const next = structuredClone(current) as ExtractedSyllabus;
      recipe(next);
      next.stats = recalculateDraftStats(next.semester);
      return next;
    });
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Detected semester</label>
            <input value={draft.semester.title} onChange={(event) => updateDraft((next) => { next.semester.title = event.target.value; })} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-lg font-semibold" />
            <div className="mt-2 text-xs text-[var(--muted)]">Provider: {draft.provider}</div>
          </div>
          <div className="grid gap-2">
            <button onClick={() => onConfirm('add-semester')} className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Add as new semester</button>
            <button onClick={() => onConfirm('merge-current')} className="rounded-xl border border-[var(--border)] px-4 py-3 text-sm">Merge into current</button>
            <button onClick={() => { const typed = prompt('This replaces the current semester structure. ORBIT will create a backup first. Type REPLACE to continue.'); if (typed === 'REPLACE') onConfirm('replace-current'); }} className="rounded-xl border border-[var(--danger)]/45 px-4 py-3 text-sm text-[var(--danger)]">Replace current</button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Subjects" value={draft.stats.subjectCount} />
          <Metric label="Topics" value={draft.stats.topicCount} />
          <Metric label="Study hours" value={`${draft.stats.estimatedStudyHours}h`} />
          <Metric label="Pace" value={draft.stats.weeklyPace} />
        </div>
      </section>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <SectionHeader title="Difficulty ranking" action="Generated from topic complexity" />
        <div className="grid gap-2">
          {draft.stats.difficultyRanking.map((item, index) => (
            <div key={item.subjectId} className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs text-[var(--accent)]">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{item.subject}</span>
              <span className="text-xs text-[var(--muted)]">{item.label} · {item.score}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-3">
        {draft.semester.subjects.map((subject, subjectIndex) => (
          <details key={subject.id} open className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <summary className="cursor-pointer p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{subject.name}</div>
                  <div className="text-xs text-[var(--muted)]">{subject.code} · {subject.credits} credits · {subject.modules.length} modules</div>
                </div>
                <button type="button" onClick={(event) => { event.preventDefault(); updateDraft((next) => { next.semester.subjects.splice(subjectIndex, 1); }); }} className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--danger)]/35 text-[var(--danger)]"><Trash2 size={15} /></button>
              </div>
            </summary>
            <div className="space-y-4 border-t border-[var(--border)] p-4">
              <div className="grid gap-2 md:grid-cols-[1fr_120px_90px]">
                <input value={subject.name} onChange={(event) => updateDraft((next) => { next.semester.subjects[subjectIndex].name = event.target.value; next.semester.subjects[subjectIndex].shortName = event.target.value.slice(0, 12); })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
                <input value={subject.code} onChange={(event) => updateDraft((next) => { next.semester.subjects[subjectIndex].code = event.target.value; })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
                <input type="number" min={0} value={subject.credits} onChange={(event) => updateDraft((next) => { next.semester.subjects[subjectIndex].credits = Number(event.target.value) || 0; })} className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
              </div>
              {subject.modules.map((module, moduleIndex) => (
                <SyllabusModuleEditor
                  key={module.id}
                  module={module}
                  onMoveUp={() => updateDraft((next) => moveItem(next.semester.subjects[subjectIndex].modules, moduleIndex, Math.max(0, moduleIndex - 1)))}
                  onMoveDown={() => updateDraft((next) => moveItem(next.semester.subjects[subjectIndex].modules, moduleIndex, Math.min(next.semester.subjects[subjectIndex].modules.length - 1, moduleIndex + 1)))}
                  onUpdate={(nextModule) => updateDraft((next) => { next.semester.subjects[subjectIndex].modules[moduleIndex] = nextModule; })}
                  onDelete={() => updateDraft((next) => { next.semester.subjects[subjectIndex].modules.splice(moduleIndex, 1); })}
                />
              ))}
              <button onClick={() => updateDraft((next) => { next.semester.subjects[subjectIndex].modules.push(makeReviewModule()); })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Add module</button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function SyllabusModuleEditor({ module, onUpdate, onDelete, onMoveUp, onMoveDown }: { module: Module; onUpdate: (module: Module) => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void }) {
  const updateModule = (recipe: (next: Module) => void) => {
    const next = structuredClone(module) as Module;
    recipe(next);
    onUpdate(next);
  };
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <div className="flex gap-2">
        <input value={module.title} onChange={(event) => updateModule((next) => { next.title = event.target.value; })} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm" />
        <button onClick={onMoveUp} className="rounded-xl border border-[var(--border)] px-3 text-sm">Up</button>
        <button onClick={onMoveDown} className="rounded-xl border border-[var(--border)] px-3 text-sm">Down</button>
        <button onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--danger)]/35 text-[var(--danger)]"><Trash2 size={15} /></button>
      </div>
      <div className="mt-3 grid gap-2">
        {module.topics.map((topic, topicIndex) => (
          <div key={topic.id} className="rounded-xl border border-[var(--border)] p-3">
            <div className="flex gap-2">
              <input value={topic.title} onChange={(event) => updateModule((next) => { next.topics[topicIndex].title = event.target.value; })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button onClick={() => updateModule((next) => { next.topics.splice(topicIndex, 1); })} className="text-[var(--danger)]"><Trash2 size={15} /></button>
            </div>
            <input value={topic.subtopics.map((item) => item.title).join(', ')} onChange={(event) => updateModule((next) => { next.topics[topicIndex].subtopics = event.target.value.split(',').map((title) => title.trim()).filter(Boolean).map(makeReviewSubtopic); })} placeholder="Subtopics, separated by commas" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs text-[var(--muted)]" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => updateModule((next) => { next.topics.push(makeReviewTopic('New topic')); })} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Add topic</button>
        <button onClick={() => updateModule((next) => { next.topics = mergeDuplicateTopics(next.topics); })} className="rounded-xl border border-[var(--accent)]/40 px-3 py-2 text-sm text-[var(--accent)]">Merge duplicate topics</button>
      </div>
    </div>
  );
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

function getMomentumLines(data: OrbitData) {
  const activity = weeklyActivity(data);
  const completedThisWeek = data.tasks.filter((task) => task.completed && activity.some((day) => day.date === task.scheduledFor)).length;
  const subjectMinutes = activeSubjects(data)
    .map((subject) => ({
      subject,
      minutes: data.sessions.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.minutes, 0),
      progress: subjectProgress(subject).percentage,
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const weakest = subjectMinutes.filter((item) => item.progress < 25).sort((a, b) => a.progress - b.progress)[0];
  const lines: string[] = [];
  if (completedThisWeek > 0) lines.push(`${completedThisWeek} study tasks completed this week`);
  if (subjectMinutes[0]?.minutes > 0) lines.push(`${subjectMinutes[0].subject.shortName} is your most active subject`);
  if (weakest) lines.push(`${weakest.subject.shortName} needs attention`);
  return lines;
}

function averageConfidence(subject: Subject) {
  const topics = subject.modules.flatMap((module) => module.topics);
  if (!topics.length) return 0;
  return topics.reduce((sum, topic) => sum + topic.confidence, 0) / topics.length;
}

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function recalculateDraftStats(semester: ExtractedSyllabus['semester']) {
  return calculateSyllabusStats(semester);
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
}

function makeReviewId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeReviewModule(): Module {
  return { id: makeReviewId('module'), title: 'New module', custom: true, topics: [makeReviewTopic('New topic')] };
}

function makeReviewTopic(title: string): Topic {
  return {
    id: makeReviewId('topic'),
    title,
    description: title,
    difficulty: 'Core',
    estimatedMinutes: 45,
    state: 'not-started',
    confidence: 1,
    checkpoints: ['concept', 'notes', 'code', 'questions', 'revision'].map((key) => ({ key: key as Topic['checkpoints'][number]['key'], label: String(key), completed: false })),
    subtopics: [],
    resources: [],
    codingQuestions: [],
    custom: true,
  };
}

function makeReviewSubtopic(title: string) {
  return {
    id: makeReviewId('subtopic'),
    title,
    state: 'not-started' as const,
    checkpoints: ['concept', 'notes', 'code', 'questions', 'revision'].map((key) => ({ key: key as Topic['checkpoints'][number]['key'], label: String(key), completed: false })),
    confidence: 1,
    estimatedMinutes: 25,
  };
}

function mergeDuplicateTopics(topics: Topic[]) {
  const byTitle = new Map<string, Topic>();
  topics.forEach((topic) => {
    const key = topic.title.trim().toLowerCase();
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, topic);
      return;
    }
    existing.subtopics = [...existing.subtopics, ...topic.subtopics].filter((subtopic, index, all) => all.findIndex((item) => item.title.toLowerCase() === subtopic.title.toLowerCase()) === index);
    existing.description = [existing.description, topic.description].filter(Boolean).join(' ');
  });
  return Array.from(byTitle.values());
}
