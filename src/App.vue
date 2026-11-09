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
  <!-- max(..., env(safe-area-inset-...)) keeps clear of the iPhone notch and home bar -->
  <main
    class="mx-auto max-w-[520px] pt-[max(72px,env(safe-area-inset-top))] pr-[max(20px,env(safe-area-inset-right))] pb-[max(40px,env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] max-[420px]:pt-[max(40px,env(safe-area-inset-top))]"
  >
    <AppHeader :offline="offline" />

    <div class="flex gap-2">
      <!-- text-base = 16px: smaller makes iPhone Safari zoom in when you tap the field -->
      <input
        v-model="newTitle"
        data-test="new"
        class="min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-4 py-3.5 text-base outline-none transition-colors placeholder:text-muted focus:border-accent"
        placeholder="What needs doing?"
        aria-label="New to-do"
        enterkeyhint="done"
        autocomplete="off"
        autofocus
        @keydown.enter="add"
      />
      <button
        data-test="add"
        class="flex-none cursor-pointer rounded-[10px] bg-accent px-[18px] text-base font-semibold text-page transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
        :disabled="!newTitle.trim()"
        @click="add"
      >
        Add
      </button>
    </div>

    <TodoList
      v-if="visible.length"
      :todos="visible"
      @toggle="toggle"
      @remove="remove"
      @rename="rename"
      @editing="setEditing"
    />

    <p v-else-if="todos.length" class="mt-10 text-center text-muted">Nothing here.</p>
    <p v-else data-test="empty" class="mt-10 text-center text-muted">No tasks yet. Add one above.</p>

    <!-- max-[420px]: = narrow phones: the filters move to their own row -->
    <footer v-if="todos.length" class="mt-4 flex items-center justify-between gap-2 text-sm text-muted max-[420px]:flex-wrap">
      <span data-test="count">{{ left }} left</span>
      <nav class="flex gap-1 max-[420px]:order-3 max-[420px]:w-full max-[420px]:justify-center">
        <button
          v-for="(label, key) in filters"
          :key="key"
          :data-test="`filter-${key}`"
          class="cursor-pointer rounded-md px-2.5 py-1.5 hover:text-ink touch:px-3 touch:py-2.5"
          :class="{ 'bg-surface text-ink': filter === key }"
          @click="filter = key"
        >
          {{ label }}
        </button>
      </nav>
      <button
        data-test="clear"
        class="cursor-pointer rounded-md px-2.5 py-1.5 enabled:hover:text-ink disabled:cursor-default disabled:opacity-40 touch:px-3 touch:py-2.5"
        :disabled="!hasDone"
        @click="clearDone"
      >
        Clear done
      </button>
    </footer>
  </main>
</template>
