import http from './http'

export default {
  getAlerts()             { return http.get('/dashboard/alerts') },
  getTripsToday(params = {}) { return http.get('/dashboard/trips-today', { params }) },
  getDriverAvailability() { return http.get('/dashboard/driver-availability') },
  getRecentActivity()     { return http.get('/dashboard/recent-activities') },
  getRiskDrivers()        { return http.get('/dashboard/risk-drivers') },
  getBirthdays()          { return http.get('/dashboard/birthdays') },
}
