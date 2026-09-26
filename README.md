# ORBIT - Semester Workspace

ORBIT is a browser-based study planner for keeping a semester, daily tasks, and notes in one place. The interface is built with plain HTML, CSS, and JavaScript; it has no framework or build step.

## Run

Install Node.js, then run:

```bash
npm run dev
```

Open the local address printed in the terminal. You can also open `index.html` directly, though imports and some browser storage behavior work best over a local server.

## Project files

- `index.html` contains the accessible application shell and dialogs.
- `styles.css` contains the responsive layout, theme variables, and component styling.
- `app.js` contains rendering, study planning interactions, local storage, and JSON import/export.
- `server.js` serves the static files locally using Node's built-in HTTP module.
- `assignent - 2/` contains the requested HTML assignment pages.

## Included workflows

- Track subjects and topic progress.
- Plan and complete daily study tasks.
- Browse in-progress topics for revision.
- Keep searchable notes tied to a subject.
- Track weekly study activity and overall progress.
- Run a 25-minute focus timer.
- Toggle light and dark themes.
- Export and import a JSON workspace backup.

Workspace data stays in this browser under the `orbit-html-workspace-v1` local storage key. Export a JSON backup before clearing browser data or switching devices.
