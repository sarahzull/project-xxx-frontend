<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import AppButton from '../../components/common/AppButton.vue'

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
    <!-- Brand panel (desktop only) -->
    <div class="login-brand-panel">
      <div class="login-brand-content">
        <div class="login-brand-wordmark">
          <div class="login-brand-dot" />
          <span class="login-brand-name">Project XXX</span>
        </div>
        <h2 class="login-brand-headline">Fleet operations,<br>precisely managed.</h2>
        <p class="login-brand-sub">Internal Logistics Management System</p>
      </div>
    </div>

    <!-- Form panel -->
    <div class="login-form-panel">
      <div class="login-card">
        <!-- Mobile wordmark -->
        <div class="login-wordmark login-wordmark--mobile">
          <div class="login-wordmark-dot" />
          <h1 class="login-title-mobile">Project XXX</h1>
        </div>

        <h1 class="login-title">Sign in</h1>
        <p class="login-sub">Welcome back. Enter your credentials to continue.</p>

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
              placeholder="your@email.com"
            />
          </div>

          <div class="login-field">
            <div class="login-field-hd">
              <label class="label" style="margin-bottom:0">Password</label>
              <a href="/forgot-password" class="login-forgot">Forgot password?</a>
            </div>
            <input
              v-model="form.password"
              type="password"
              required
              autocomplete="current-password"
              class="input"
              style="margin-top:6px"
              placeholder="Enter your password"
            />
          </div>

          <AppButton type="submit" :loading="loading" size="lg" style="width:100%;margin-top:4px;">
            Sign In
          </AppButton>
        </form>
      </div>
    </div>
  </div>
</template>
