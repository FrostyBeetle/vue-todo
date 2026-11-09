<script setup>
import { ref, nextTick } from 'vue'

// One row: checkbox, title (or the edit box) and a delete button.
// A component may not change its props, so it only *tells* the parent what
// happened with emit(); App.vue makes the actual change to the list.
const props = defineProps({
  todo: { type: Object, required: true },
})
const emit = defineEmits(['toggle', 'remove', 'rename', 'editing'])

const editing = ref(false)
const editTitle = ref('')
const editInput = ref(null)

// Touch screens have no real double-click (Safari zooms instead), so a single tap edits there
const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches

function onTitleClick() {
  if (isTouch) startEdit()
}

async function startEdit() {
  editing.value = true
  editTitle.value = props.todo.title
  emit('editing', true)
  await nextTick()
  editInput.value?.focus()
}

function stopEdit() {
  editing.value = false
  emit('editing', false)
}

function saveEdit() {
  if (!editing.value) return // already saved or cancelled (blur after Enter/Escape)
  stopEdit()
  emit('rename', editTitle.value.trim()) // an empty title means: delete it
}
</script>

<template>
  <li class="item" :class="{ done: todo.done }">
    <input
      data-test="toggle"
      type="checkbox"
      class="check"
      :checked="todo.done"
      :aria-label="`Mark ${todo.title} as done`"
      @change="emit('toggle')"
    />
    <input
      v-if="editing"
      ref="editInput"
      v-model="editTitle"
      data-test="edit"
      class="edit"
      aria-label="Edit to-do"
      enterkeyhint="done"
      autocomplete="off"
      @keydown.enter="saveEdit"
      @keydown.escape="stopEdit"
      @blur="saveEdit"
    />
    <span
      v-else
      data-test="title"
      class="title"
      :title="isTouch ? 'Tap to edit' : 'Double-click to edit'"
      @click="onTitleClick"
      @dblclick="startEdit"
    >
      {{ todo.title }}
    </span>
    <button data-test="delete" class="delete" :aria-label="`Delete ${todo.title}`" @click="emit('remove')">
      ×
    </button>
  </li>
</template>

<style scoped>
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
  font-size: 16px; /* under 16px, iPhone Safari zooms in when you tap the field */
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
}
</style>
