# ORBIT - Your Semester Operating System

ORBIT is a private academic productivity web app for reusable semester planning. It tracks a syllabus from semester down to learning actions, with topic states, independent checkpoints, notes, daily planning, focus sessions, spaced revision and analytics.

## Setup

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Architecture

- `app/` contains the Next.js App Router entry, metadata and global theme CSS.
- `components/OrbitApp.tsx` contains the responsive application shell, pages, panels and interaction surfaces.
- `lib/types.ts` defines the typed domain model for Semester, Subject, Module, Topic, Subtopic, StudyTask, Revision, Note, StudySession and UserPreferences.
- `lib/seed.ts` contains the seeded syllabus and realistic initial progress.
- `lib/progress.ts` contains reusable progress, search and revision helpers.
- `store/useOrbitStore.ts` is the Zustand store with localStorage persistence.

## Persistence

ORBIT uses device-local `localStorage` through Zustand persist. Storage is versioned with `schemaVersion` and normalized on load so missing or older data falls back safely instead of breaking the app.

Persisted data includes:

- semesters
- subjects
- modules
- topics
- subtopics
- checkpoints
- study tasks
- notes
- revisions
- study sessions
- streak metadata
- user preferences

Recommended future Supabase tables:

- `semesters`
- `subjects`
- `modules`
- `topics`
- `subtopics`
- `checklist_items`
- `study_tasks`
- `revisions`
- `notes`
- `study_sessions`
- `user_preferences`

The store methods can become a thin repository layer that reads and writes through Supabase while keeping the same component contract.

## Included Features

- First-launch product onboarding: create/select semester, choose setup method, choose study preference and daily availability
- Optional B.Tech CSE AIML syllabus template with zero seeded progress
- Manual custom syllabus builder
- JSON import/export
- PDF syllabus upload UI with mocked parser service
- Dark and light themes
- Responsive desktop sidebar and mobile bottom navigation
- Global search across subjects, modules, topics, subtopics, notes and tasks
- Overview dashboard with computed recommended task, orbital progress visual, daily plan, subject progress, revision due, weekly activity and momentum
- Subject detail with roadmap, modules, practice, notes, revision and analytics tabs
- Topic detail panel with learning state, checkpoints, confidence slider, notes, resources, coding questions, due metadata and custom topic deletion
- Today planner with drag-and-drop task ordering, quick capture and time blocks
- Focus mode with timer, scratch notes and session completion
- Spaced revision workflow with confidence-based rescheduling
- Notes library
- JSON export/import, custom subject/topic creation and reset progress
- Installable PWA shell with manifest, icons and offline app shell

## Mocked Areas

`lib/syllabusImport.ts` exposes the intended parser contract:

```ts
parseSyllabus(file) -> subjects -> modules -> topics -> subtopics
```

PDF parsing is currently mocked in development. Plain-text parsing is heuristic. No screen pretends that PDF parsing succeeded without a real API.

## Testing Checklist

1. Run `npm run dev` and open the local URL.
2. Start with a blank profile and confirm overall progress is `0%`, streak is `0`, and weekly activity is empty.
3. Use the B.Tech template and confirm all topics remain not started.
4. Add a subject, module, topic and subtopic from Subjects or Settings.
5. Toggle topic checkpoints, refresh the page, and confirm the state persists.
6. Complete a focus session and confirm weekly activity and streak update.
7. Export JSON, reset progress, import JSON, and confirm the semester returns.
8. Upload a PDF syllabus and confirm ORBIT clearly reports mocked parsing.
9. Use a mobile viewport and confirm bottom navigation and full-screen topic sheet behavior.
