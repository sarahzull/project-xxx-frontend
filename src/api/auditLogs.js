import http from './http'

export default {
  list(params = {}) {
    return http.get('/audit-logs', { params })
  },
}
