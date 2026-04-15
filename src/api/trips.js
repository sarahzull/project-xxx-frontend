import http from './http'

export default {
  list(params = {}) {
    return http.get('/trips', { params })
  },
  calculateRate(data) {
    return http.post('/trips/calculate-rate', data)
  },
}
