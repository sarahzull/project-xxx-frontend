import http from './http'

export default {
  list(params = {}) {
    return http.get('/drivers', { params })
  },
  get(driverId) {
    return http.get(`/drivers/${driverId}`)
  },
  trips(driverId, params = {}) {
    return http.get(`/drivers/${driverId}/trips`, { params })
  },
  kmSummary(driverId) {
    return http.get(`/drivers/${driverId}/km-summary`)
  },
}
