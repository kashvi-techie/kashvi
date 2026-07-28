# ORBIT - Your Semester Operating System

ORBIT is a private academic progress web app for a second-year B.Tech CSE AIML student. It tracks the syllabus from semester down to learning actions, with topic states, independent checkpoints, notes, daily planning, focus sessions, spaced revision and analytics.

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

The first version uses device-local `localStorage` through Zustand persist. The data model is intentionally shaped as plain typed entities so it can later be moved to Supabase tables without rewriting the UI.

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

- First-launch onboarding with skip
- Dark and light themes
- Responsive desktop sidebar and mobile bottom navigation
- Global search across subjects, modules, topics, subtopics, notes and tasks
- Overview dashboard with recommended task, orbital progress visual, daily plan, subject progress, revision due, activity and momentum
- Subject detail with roadmap, modules, practice, notes, revision and analytics tabs
- Topic detail panel with learning state, checkpoints, confidence slider, notes, resources, coding questions, due metadata and custom topic deletion
- Today planner with drag-and-drop task ordering, quick capture and time blocks
- Focus mode with timer, scratch notes and session completion
- Spaced revision workflow with confidence-based rescheduling
- Notes library
- JSON export/import, custom subject/topic creation and reset progress
