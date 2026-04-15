import http from './http'

export default {
  // Admin: list all letters sent (optional params: driver_id, type, page)
  list(params = {})   { return http.get('/letters', { params }) },
  // Admin: compose and send a letter to a driver
  send(data)          { return http.post('/letters', data) },
  // Admin: get single letter detail
  get(id)             { return http.get(`/letters/${id}`) },

  // Driver: list own received letters
  myLetters()         { return http.get('/driver/me/letters') },
}
