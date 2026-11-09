<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { fetchTodos, saveTodos } from './api.js'
import AppHeader from './components/AppHeader.vue'
import TodoList from './components/TodoList.vue'

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
const editingId = ref(null) // the to-do being edited, so a sync never replaces the list mid-edit
const offline = ref(false)

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

function toggle(todo) {
  todo.done = !todo.done
}

function rename(todo, title) {
  if (title) todo.title = title
  else remove(todo) // an empty title deletes the to-do
}

function setEditing(todo, isEditing) {
  editingId.value = isEditing ? todo.id : null
}
</script>

<template>
  <main class="app">
    <AppHeader :offline="offline" />

    <div class="add-row">
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
      <button data-test="add" class="add" :disabled="!newTitle.trim()" @click="add">Add</button>
    </div>

    <TodoList
      v-if="visible.length"
      :todos="visible"
      @toggle="toggle"
      @remove="remove"
      @rename="rename"
      @editing="setEditing"
    />

    <p v-else-if="todos.length" class="empty">Nothing here.</p>
    <p v-else data-test="empty" class="empty">No tasks yet. Add one above.</p>

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

.add-row {
  display: flex;
  gap: 8px;
}

.add {
  flex: none;
  padding: 0 18px;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  color: var(--bg);
  background: var(--accent);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.add:disabled {
  opacity: 0.4;
  cursor: default;
}
.add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.new {
  flex: 1;
  min-width: 0;
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

/* Touch screens: bigger footer buttons for fingers */
@media (hover: none) {
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
