<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import AppButton from '../../components/common/AppButton.vue'
import { TruckIcon } from '../../components/icons/index.js'

const auth = useAuthStore()
const router = useRouter()

const form = ref({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(form.value)
    router.push('/')
  } catch (e) {
    error.value = e.response?.data?.message || 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Icon -->
      <div class="login-icon">
        <TruckIcon :size="28" />
      </div>

      <h1 class="login-title">Project XXX</h1>
      <p class="login-sub">Internal Logistics Backup System</p>

      <form @submit.prevent="handleLogin">
        <div v-if="error" class="alert-error mb-4">{{ error }}</div>

        <div class="login-field">
          <label class="label">Email address</label>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
            class="input"
            placeholder="admin@projectxxx.com"
          />
        </div>

        <div class="login-field">
          <label class="label">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            class="input"
            placeholder="Enter your password"
          />
        </div>

        <AppButton type="submit" :loading="loading" size="lg" style="width:100%;margin-top:4px;">
          Sign In
        </AppButton>
      </form>

      <p class="login-hint">Demo: admin@projectxxx.com / password123</p>
    </div>
  </div>
</template>
