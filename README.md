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
- `lib/seed.ts` contains the optional B.Tech CSE AIML template with zero seeded progress.
- `lib/progress.ts` contains reusable progress, search and revision helpers.
- `lib/syllabusImport.ts` contains the syllabus extraction provider interface, PDF text extraction, rule-based parser and import statistics.
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

- First-launch product onboarding centered on syllabus PDF ingestion, review and confirmation
- Optional B.Tech CSE AIML syllabus template with zero seeded progress
- Manual custom syllabus builder
- JSON import/export
- PDF syllabus upload with rule-based text extraction and structured review before import
- Editable syllabus preview: rename subjects, edit codes/credits/topics, reorder modules, merge duplicates, delete incorrect entries and add missing topics
- Generated import intelligence: semester statistics, estimated study hours, topic counts, weekly study pace and subject difficulty ranking
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

## Syllabus Ingestion

`lib/syllabusImport.ts` exposes the intended parser contract:

```ts
extractSyllabus(file)
  -> Semester
    -> Subjects
      -> Code, Credits
      -> Modules
        -> Topics
          -> Subtopics
```

The first provider uses client-side PDF text extraction plus rule-based processing for common university syllabus formats. It is intentionally exposed behind `SyllabusParserProvider`, so an LLM provider such as Gemini, OpenAI or Claude can enhance extraction later without changing the onboarding or review UI.

Imported data is not saved immediately. ORBIT always shows a structured review screen first, and the semester is generated only after confirmation.

## Testing Checklist

1. Run `npm run dev` and open the local URL.
2. Start with a blank profile and confirm overall progress is `0%`, streak is `0`, and weekly activity is empty.
3. Use the B.Tech template and confirm all topics remain not started.
4. Add a subject, module, topic and subtopic from Subjects or Settings.
5. Toggle topic checkpoints, refresh the page, and confirm the state persists.
6. Complete a focus session and confirm weekly activity and streak update.
7. Export JSON, reset progress, import JSON, and confirm the semester returns.
8. Upload or paste a syllabus and confirm the review screen appears before data is saved.
9. Edit a subject, reorder a module, merge duplicate topics, add a topic, then generate the semester.
10. Use a mobile viewport and confirm bottom navigation and full-screen topic sheet behavior.
