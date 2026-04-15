import axios from 'axios'
import router from '../router'

const http = axios.create({
  // In dev:  VITE_API_URL is unset → Vite proxy forwards /api → localhost:8000
  // In prod: VITE_API_URL = https://your-backend.up.railway.app/api
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
    }
    return Promise.reject(error)
  }
)

export default http
