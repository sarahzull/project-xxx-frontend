import http from './http'

export default {
  update(data) {
    return http.patch('/auth/profile', data)
  },
}
