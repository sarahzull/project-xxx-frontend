import http from './http'

export default {
  // Sidebar badge (role-aware) — admins: pending review; drivers: unread coachings
  badge()                       { return http.get('/safety/badge') },

  // Admin
  fleet(params = {})            { return http.get('/safety/fleet', { params }) },
  driver(userId, params = {})   { return http.get(`/safety/drivers/${userId}`, { params }) },
  events(params = {})           { return http.get('/safety/events', { params }) },
  review(eventId)               { return http.post(`/safety/events/${eventId}/review`) },
  coach(eventId, note)          { return http.post(`/safety/events/${eventId}/coach`, { note }) },

  // Driver-self
  myOwn(params = {})            { return http.get('/driver/me/safety', { params }) },
  acknowledgeNote(noteId)       { return http.patch(`/driver/me/safety/coaching/${noteId}/ack`) },
}
