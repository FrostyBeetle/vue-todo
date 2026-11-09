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
  <!-- "group" lets the × button react when the mouse is anywhere on the row (group-hover:) -->
  <li class="group flex min-h-12 items-center gap-3 border-b border-line py-1 pr-1 pl-2 touch:min-h-14">
    <!-- A round checkbox: appearance-none hides the normal one, after: draws the tick -->
    <input
      data-test="toggle"
      type="checkbox"
      class="grid size-5 flex-none cursor-pointer appearance-none place-content-center rounded-full border-[1.5px] border-muted transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent touch:size-6 after:h-[9px] after:w-[5px] after:-translate-y-px after:rotate-45 after:border-r-2 after:border-b-2 after:border-page after:opacity-0 after:content-[''] checked:after:opacity-100"
      :checked="todo.done"
      :aria-label="`Mark ${todo.title} as done`"
      @change="emit('toggle')"
    />
    <!-- text-base = 16px: smaller makes iPhone Safari zoom in when you tap the field -->
    <input
      v-if="editing"
      ref="editInput"
      v-model="editTitle"
      data-test="edit"
      class="-my-[7px] -ml-[9px] min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-1.5 text-base outline-none"
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
      class="min-w-0 flex-1 cursor-text wrap-anywhere transition-colors touch:cursor-pointer"
      :class="{ 'text-muted line-through': todo.done }"
      :title="isTouch ? 'Tap to edit' : 'Double-click to edit'"
      @click="onTitleClick"
      @dblclick="startEdit"
    >
      {{ todo.title }}
    </span>
    <!-- Hidden until you hover the row on a PC; always visible and 44px big on touch screens -->
    <button
      data-test="delete"
      class="size-8 flex-none cursor-pointer rounded-md text-xl leading-none text-muted opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 touch:-mr-1.5 touch:size-11 touch:opacity-100"
      :aria-label="`Delete ${todo.title}`"
      @click="emit('remove')"
    >
      ×
    </button>
  </li>
</template>
