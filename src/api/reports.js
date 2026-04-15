import http from './http'

export default {
  driverSummary() {
    return http.get('/reports/driver-summary')
  },
  tripSummary(params = {}) {
    return http.get('/reports/trip-summary', { params })
  },
  licenseExpiry() {
    return http.get('/reports/license-expiry')
  },
  blockedDrivers() {
    return http.get('/reports/blocked-drivers')
  },
  monthlyTrips() {
    return http.get('/reports/monthly-trips')
  },
}
