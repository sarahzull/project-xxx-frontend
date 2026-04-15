import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authApi from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || null)

  const isAuthenticated = computed(() => !!token.value)
  const userName = computed(() => user.value?.name || '')
  const userRoles = computed(() => user.value?.roles?.map(r => r.slug) || [])

  function hasRole(slug) {
    return userRoles.value.includes(slug)
  }

  async function login(credentials) {
    const { data } = await authApi.login(credentials)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      token.value = null
      user.value = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  async function fetchUser() {
    try {
      const { data } = await authApi.me()
      user.value = data.user
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch {
      await logout()
    }
  }

  function setUser(updatedUser) {
    user.value = updatedUser
    localStorage.setItem('user', JSON.stringify(updatedUser))
  }

  return { user, token, isAuthenticated, userName, userRoles, hasRole, login, logout, fetchUser, setUser }
})
