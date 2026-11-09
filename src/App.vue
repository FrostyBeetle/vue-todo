<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { fetchTodos, saveTodos } from './api.js'

const STORAGE_KEY = 'vue-todo:items'
const UNSYNCED_KEY = 'vue-todo:unsynced'
const SAVE_DELAY = 300 // ms after the last change
const CHECK_EVERY = 3000 // ms between checks for changes from other devices

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

const todos = ref(load())
const newTitle = ref('')
const filter = ref('all')
const editingId = ref(null)
const editTitle = ref('')
const editInput = ref(null)
const offline = ref(false)

// Touch screens have no real double-click (Safari zooms instead), so a single tap edits there
const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches

function onTitleClick(todo) {
  if (isTouch) startEdit(todo)
}

// --- Sync with the PC (server/todoApi.js) ---
// "unsynced" = this device has changes the server hasn't confirmed yet. It's kept in
// localStorage too, so changes made offline survive a reload and are sent later.
let unsynced = localStorage.getItem(UNSYNCED_KEY) === '1'
let changeCount = 0 // so a slow save can't mark newer changes as synced
let saveTimer = null
let checkTimer = null
let busy = false
let applyingRemote = false

function setUnsynced(value) {
  unsynced = value
  if (value) localStorage.setItem(UNSYNCED_KEY, '1')
  else localStorage.removeItem(UNSYNCED_KEY)
}

// flush: 'sync' runs this right away, so applyingRemote is still true for server updates
watch(todos, (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  if (applyingRemote) return
  changeCount++
  setUnsynced(true)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(push, SAVE_DELAY)
}, { deep: true, flush: 'sync' })

async function push() {
  saveTimer = null
  const sent = changeCount
  try {
    await saveTodos(todos.value)
    offline.value = false
    if (changeCount === sent) setUnsynced(false)
  } catch {
    offline.value = true
  }
}

async function pull() {
  if (busy) return
  busy = true
  try {
    if (unsynced) {
      if (!saveTimer) await push() // my own changes go first
      return
    }
    if (editingId.value !== null) return
    const items = await fetchTodos()
    offline.value = false
    if (items === null) {
      if (todos.value.length) await push() // first run: the server starts with my list
      return
    }
    if (unsynced || editingId.value !== null) return // something changed while we waited
    if (JSON.stringify(items) !== JSON.stringify(todos.value)) {
      applyingRemote = true
      todos.value = items
      applyingRemote = false
    }
  } catch {
    offline.value = true
  } finally {
    busy = false
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') pull()
}

onMounted(() => {
  pull()
  checkTimer = setInterval(pull, CHECK_EVERY)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', pull)
})

onUnmounted(() => {
  clearInterval(checkTimer)
  clearTimeout(saveTimer)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('online', pull)
})

const filters = { all: 'All', active: 'Active', done: 'Done' }
const visible = computed(() => {
  if (filter.value === 'active') return todos.value.filter((t) => !t.done)
  if (filter.value === 'done') return todos.value.filter((t) => t.done)
  return todos.value
})
const left = computed(() => todos.value.filter((t) => !t.done).length)
const hasDone = computed(() => todos.value.some((t) => t.done))

function add() {
  const title = newTitle.value.trim()
  if (!title) return
  todos.value.push({ id: Date.now() + Math.random(), title, done: false })
  newTitle.value = ''
}

function remove(todo) {
  todos.value = todos.value.filter((t) => t.id !== todo.id)
}

function clearDone() {
  todos.value = todos.value.filter((t) => !t.done)
}

async function startEdit(todo) {
  editingId.value = todo.id
  editTitle.value = todo.title
  await nextTick()
  editInput.value?.[0]?.focus()
}

function saveEdit(todo) {
  if (editingId.value !== todo.id) return // already saved or cancelled (blur after Enter/Escape)
  editingId.value = null
  const title = editTitle.value.trim()
  if (title) todo.title = title
  else remove(todo)
}

function cancelEdit() {
  editingId.value = null
}
</script>

<template>
  <main class="app">
    <header class="header">
      <h1>To-do</h1>
      <span v-if="offline" data-test="offline" class="offline" title="Changes will sync when the PC is reachable">
        Offline · saved on this device
      </span>
    </header>

    <input
      v-model="newTitle"
      data-test="new"
      class="new"
      placeholder="What needs doing?"
      aria-label="New to-do"
      enterkeyhint="done"
      autocomplete="off"
      autofocus
      @keydown.enter="add"
    />

    <ul v-if="visible.length" class="list">
      <li v-for="todo in visible" :key="todo.id" class="item" :class="{ done: todo.done }">
        <input
          v-model="todo.done"
          data-test="toggle"
          type="checkbox"
          class="check"
          :aria-label="`Mark ${todo.title} as done`"
        />
        <input
          v-if="editingId === todo.id"
          ref="editInput"
          v-model="editTitle"
          data-test="edit"
          class="edit"
          aria-label="Edit to-do"
          enterkeyhint="done"
          autocomplete="off"
          @keydown.enter="saveEdit(todo)"
          @keydown.escape="cancelEdit"
          @blur="saveEdit(todo)"
        />
        <span
          v-else
          data-test="title"
          class="title"
          :title="isTouch ? 'Tap to edit' : 'Double-click to edit'"
          @click="onTitleClick(todo)"
          @dblclick="startEdit(todo)"
        >
          {{ todo.title }}
        </span>
        <button data-test="delete" class="delete" :aria-label="`Delete ${todo.title}`" @click="remove(todo)">
          ×
        </button>
      </li>
    </ul>

    <p v-else class="empty">{{ todos.length ? 'Nothing here.' : 'All clear. Add something above.' }}</p>

    <footer v-if="todos.length" class="footer">
      <span data-test="count">{{ left }} left</span>
      <nav class="filters">
        <button
          v-for="(label, key) in filters"
          :key="key"
          :data-test="`filter-${key}`"
          :class="{ active: filter === key }"
          @click="filter = key"
        >
          {{ label }}
        </button>
      </nav>
      <button data-test="clear" class="clear" :disabled="!hasDone" @click="clearDone">Clear done</button>
    </footer>
  </main>
</template>

<style scoped>
.app {
  max-width: 520px;
  margin: 0 auto;
  /* env(safe-area-inset-*) keeps clear of the iPhone notch and home bar */
  padding:
    max(72px, env(safe-area-inset-top))
    max(20px, env(safe-area-inset-right))
    max(40px, env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
}

.offline {
  font-size: 13px;
  color: var(--muted);
}
.offline::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--danger);
  vertical-align: middle;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.new {
  width: 100%;
  padding: 14px 16px;
  font: inherit;
  font-size: 16px; /* under 16px, iPhone Safari zooms in when you tap the field */
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.15s;
}
.new:focus {
  border-color: var(--accent);
}

.list {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 4px 4px 4px 8px;
  border-bottom: 1px solid var(--border);
}

.check {
  appearance: none;
  flex: none;
  width: 20px;
  height: 20px;
  margin: 0;
  border: 1.5px solid var(--muted);
  border-radius: 50%;
  cursor: pointer;
  display: grid;
  place-content: center;
  transition: background 0.15s, border-color 0.15s;
}
.check::after {
  content: '';
  width: 5px;
  height: 9px;
  border: solid var(--bg);
  border-width: 0 2px 2px 0;
  transform: translateY(-1px) rotate(45deg);
  opacity: 0;
}
.check:checked {
  background: var(--accent);
  border-color: var(--accent);
}
.check:checked::after {
  opacity: 1;
}
.check:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  cursor: text;
  transition: color 0.15s;
}
.done .title {
  color: var(--muted);
  text-decoration: line-through;
}

.edit {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  margin: -7px 0 -7px -9px;
  font: inherit;
  font-size: 16px; /* same iPhone zoom rule as .new */
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 6px;
  outline: none;
}

.delete {
  flex: none;
  width: 32px;
  height: 32px;
  font-size: 20px;
  line-height: 1;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.item:hover .delete,
.delete:focus-visible {
  opacity: 1;
}
.delete:hover {
  color: var(--danger);
}
/* Touch screens: no hover, and fingers need targets of about 44px */
@media (hover: none) {
  .item {
    min-height: 56px;
  }
  .check {
    width: 24px;
    height: 24px;
  }
  .delete {
    width: 44px;
    height: 44px;
    margin-right: -6px;
    opacity: 1;
  }
  .title {
    cursor: pointer;
  }
  .footer button {
    padding: 10px 12px;
  }
}

.empty {
  margin: 40px 0 0;
  text-align: center;
  color: var(--muted);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 16px;
  font-size: 14px;
  color: var(--muted);
}

.filters {
  display: flex;
  gap: 4px;
}

.footer button {
  padding: 6px 10px;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.footer button:hover:not(:disabled) {
  color: var(--text);
}
.filters button.active {
  color: var(--text);
  background: var(--surface);
}
.clear:disabled {
  opacity: 0.4;
  cursor: default;
}

@media (max-width: 420px) {
  .app {
    padding-top: 40px;
  }
  .footer {
    flex-wrap: wrap;
  }
  .filters {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}
</style>
