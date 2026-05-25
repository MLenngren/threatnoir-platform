<template>
  <div />
</template>

<script setup lang="ts">
// Legacy admin login page — redirect to unified auth
navigateTo('/auth/login?redirect=/admin', { replace: true })
</script>
