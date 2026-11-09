<script setup>
// The title bar. App.vue tells it whether the PC can be reached.
defineProps({
  offline: { type: Boolean, default: false },
})
</script>

<template>
  <header class="mb-6 flex items-baseline justify-between gap-3">
    <h1 class="text-[28px] font-semibold tracking-tight">To-do</h1>
    <!-- before:... draws the small red dot in front of the text -->
    <span
      v-if="offline"
      data-test="offline"
      class="text-[13px] text-muted before:mr-1.5 before:inline-block before:size-1.5 before:rounded-full before:bg-danger before:align-middle before:content-['']"
      title="Changes will sync when the PC is reachable"
    >
      Offline · saved on this device
    </span>
  </header>
</template>
