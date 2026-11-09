# vue-todo

A minimal to-do list built with Vue 3, Vite and Tailwind CSS. To-dos are saved in the browser (`localStorage`), so they survive a reload.

School assignment: **C25 | VUE.JS – Eindopdracht: Bouw een To-Do App**.

## Run it
```bash
npm install
npm run dev        # then open http://localhost:5173
```
Needs Node.js 22.18+ or 24.12+.

## Assignment checklist
| Requirement | Where |
|---|---|
| 1. Add tasks with `ref()`, `v-model` and a button with `@click` | `src/App.vue`: `newTitle = ref('')`, `v-model="newTitle"`, `<button @click="add">` (Enter works too) |
| 2. Show tasks with `v-for` | `src/components/TodoList.vue`: `v-for="todo in todos"` |
| 3. Delete a task with a button and a function in `<script setup>` | × button in `TodoItem.vue` → `remove()` in `App.vue` |
| 4. Conditional display with `v-if` | `App.vue`: the list only shows with `v-if="visible.length"`, otherwise "No tasks yet. Add one above." (`v-else`); the footer and the offline label use `v-if` too |
| 5. At least one own component, imported in `App.vue` | `AppHeader.vue`, `TodoList.vue`, `TodoItem.vue` in `src/components/` |
| 6. Tailwind CSS | All styling is Tailwind classes, see [Styling](#styling-tailwind-css) |
| A. Tick tasks off as done | Round checkbox in `TodoItem.vue` |
| B. Show the number of open tasks | "x left" in the footer (`left` computed in `App.vue`) |
| C. Filter All / Active / Done | Buttons in the footer (`filter` + `visible` computed in `App.vue`) |
| D. Priorities High / Medium / Low | Picker next to the input, coloured label per task (click to change), list sorted High first; `src/priorities.js` |
| E. Saved in `localStorage` | `watch` in `App.vue` saves every change; reload and everything is still there |

Extra: edit a title with a double-click, "Clear done", dark mode, works on iPhone, sync between phone and PC, and 33 automated tests (`npx vitest run`).

## Features
- Type and press **Enter** (or click **Add**) to add a to-do
- Click the circle to mark it done
- **Double-click** a title to edit it (on a phone: **tap** it). Enter saves, Escape cancels, empty deletes.
- Made for iPhone Safari too: no double-tap zoom (`touch-action: manipulation`), inputs at 16px (smaller makes Safari zoom in), tap targets of 44px, and room for the notch and home bar
- Filters: All / Active / Done, plus "Clear done"
- Priorities: pick High / Medium / Low when you add a to-do. The list shows High first. Click a to-do's coloured label to change it (High → Medium → Low).
- Light and dark mode follow your system setting

## Open it on my phone
`npm run dev` also shares the site on the network (`server.host` in `vite.config.js`). The PC must be on with the server running.
- Same Wi-Fi: open the `Network:` address Vite prints, e.g. `http://192.168.1.20:5173` (the IP can change)
- Anywhere, with Tailscale on the phone: `http://<your-pc-name>:5173` (`vite.config.js` allows this PC's own name automatically)

## Sync between devices
All devices share one list, stored on the PC in `data/todos.json` (not in git).
- `server/todoApi.js` adds `GET`/`PUT /api/todos` to the Vite server (dev and `vite preview`).
- `src/api.js` calls it. `App.vue` saves 0.3 s after a change and checks for changes from other devices every 3 s, and also when you switch back to the tab.
- When the PC can't be reached, the page shows "Offline · saved on this device". Changes are kept in `localStorage` (also across a reload) and sent when the PC is back.
- If two devices change the list at the same moment, the last save wins.
- Anyone who can reach the site (same Wi-Fi or my Tailscale) can read and change the list. There's no login.

## Check it
```bash
npm run lint       # oxlint + ESLint
npx vitest run     # tests in src/__tests__ and server/__tests__
npm run build      # production files in dist/
```

## Where things are
- `src/App.vue`: the data (the to-do list), adding, filters, and the sync. Every change to the list happens here.
- `src/components/AppHeader.vue`: the title and the offline label
- `src/components/TodoList.vue`: the list; shows one `TodoItem` per to-do with `v-for`
- `src/components/TodoItem.vue`: one row (checkbox, title or edit box, delete). It gets its to-do as a **prop** and reports clicks back with **emit** (`toggle`, `remove`, `rename`, `editing`).
- `src/api.js`: fetch calls to the save API
- `server/todoApi.js`: the save API (a Vite plugin)
- `data/todos.json`: the shared list
- `src/assets/main.css`: loads Tailwind CSS, my colours (CSS variables, with a dark set) and base styles

## Styling: Tailwind CSS
All styling is done with Tailwind classes in the templates (no `<style>` blocks). Tailwind runs as a Vite plugin (`@tailwindcss/vite` in `vite.config.js`).
- My own colour classes come from `@theme inline` in `main.css`: `bg-page`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-danger`. They point at CSS variables, so dark mode switches automatically.
- `touch:` is a custom variant for screens without a mouse (phones): bigger buttons and the × always visible.
- `group` + `group-hover:` shows the × button when you hover a row; `max-[420px]:` changes the layout on narrow phones.
