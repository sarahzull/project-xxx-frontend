import http from './http'

export default {
  // List all notifications for the authenticated user
  list()              { return http.get('/notifications') },
  // Get unread notification count
  unreadCount()       { return http.get('/notifications/unread-count') },
  // Mark a single notification as read
  markRead(id)        { return http.patch(`/notifications/${id}/read`) },
  // Mark all notifications as read
  markAllRead()       { return http.patch('/notifications/read-all') },
  // Delete every notification row for the authenticated user
  clearAll()          { return http.delete('/notifications') },
}
