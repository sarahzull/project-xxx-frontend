import http from './http'

export default {
  getTripRates()                  { return http.get('/rates/trip-rates') },
  createTripRates(rates)          { return http.post('/rates/trip-rates', { rates }) },
  updateTripRates(rates)          { return http.put('/rates/trip-rates', { rates }) },
  deleteTripRates(ids)            { return http.delete('/rates/trip-rates', { data: { ids } }) },

  getSpecialNoteRates()           { return http.get('/rates/special-notes') },
  getSpecialNoteOptions()         { return http.get('/rates/special-notes/options') },
  updateSpecialNoteRates(rates)   { return http.put('/rates/special-notes', { rates }) },
  createSpecialNote(data)         { return http.post('/rates/special-notes', data) },
  deleteSpecialNote(id)           { return http.delete(`/rates/special-notes/${id}`) },
}
