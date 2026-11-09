<script setup>
// The title bar. App.vue tells it whether the PC can be reached.
defineProps({
  offline: { type: Boolean, default: false },
})
</script>

<template>
  <header class="header">
    <h1>To-do</h1>
    <span v-if="offline" data-test="offline" class="offline" title="Changes will sync when the PC is reachable">
      Offline · saved on this device
    </span>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
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
</style>
