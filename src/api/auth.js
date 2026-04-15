import http from './http'

export default {
  login(credentials) {
    return http.post('/auth/login', credentials)
  },
  logout() {
    return http.post('/auth/logout')
  },
  me() {
    return http.get('/auth/me')
  },
}
