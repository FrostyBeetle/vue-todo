<script setup>
import TodoItem from './TodoItem.vue'

// Shows a list of to-dos. It changes nothing itself: it passes each item's
// events up to App.vue, together with the to-do they are about.
defineProps({
  todos: { type: Array, required: true },
})
const emit = defineEmits(['toggle', 'remove', 'rename', 'priority', 'editing'])
</script>

<template>
  <ul data-test="list" class="mt-4">
    <TodoItem
      v-for="todo in todos"
      :key="todo.id"
      :todo="todo"
      @toggle="emit('toggle', todo)"
      @remove="emit('remove', todo)"
      @rename="(title) => emit('rename', todo, title)"
      @priority="emit('priority', todo)"
      @editing="(isEditing) => emit('editing', todo, isEditing)"
    />
  </ul>
</template>
