import http from './http'

export default {
  profile()              { return http.get('/driver/me') },
  trips(params = {})     { return http.get('/driver/me/trips',      { params }) },
  kmSummary()            { return http.get('/driver/me/km-summary') },
  earnings(params = {})  { return http.get('/driver/me/earnings',   { params }) },
  payslips()             { return http.get('/driver/me/payslips') },
  payslip(id)            { return http.get(`/driver/me/payslips/${id}`) },
}
