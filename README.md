# vue-todo

A minimal to-do list built with Vue 3 and Vite. To-dos are saved in the browser (`localStorage`), so they survive a reload.

## Features
- Type and press **Enter** to add a to-do
- Click the circle to mark it done
- **Double-click** a title to edit it (on a phone: **tap** it). Enter saves, Escape cancels, empty deletes.
- Made for iPhone Safari too: no double-tap zoom (`touch-action: manipulation`), inputs at 16px (smaller makes Safari zoom in), tap targets of 44px, and room for the notch and home bar
- Filters: All / Active / Done, plus "Clear done"
- Light and dark mode follow your system setting

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
```

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
- `src/assets/main.css`: colours (CSS variables) and base styles
