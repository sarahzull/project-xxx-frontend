import http from './http'

export default {
  // Admin: list all driver communications (optional params: driver_id, type, page)
  list(params = {})   { return http.get('/communications', { params }) },
  // Admin: compose and send a communication to a driver
  send(data)          { return http.post('/communications', data) },
  // Admin: get single communication detail
  get(id)             { return http.get(`/communications/${id}`) },
  // Admin: resend an existing communication
  resend(id)          { return http.post(`/communications/${id}/resend`) },

  // Driver: list own received communications
  myList()            { return http.get('/driver/me/communications') },
  // Driver: mark a communication as read
  markRead(id)        { return http.patch(`/driver/me/communications/${id}/read`) },
}
