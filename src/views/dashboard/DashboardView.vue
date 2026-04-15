<script setup>
import { useAuthStore } from '../../stores/auth'
import AdminDashboardView from './AdminDashboardView.vue'
import DriverDashboardView from './DriverDashboardView.vue'

const auth = useAuthStore()
</script>

<template>
  <AdminDashboardView  v-if="auth.hasRole('admin')" />
  <DriverDashboardView v-else />
</template>
