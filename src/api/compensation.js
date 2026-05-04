import http from './http'

export default {
  listBatches(params = {}) {
    return http.get('/compensation/batches', { params })
  },
  createBatch(data) {
    return http.post('/compensation/batches', data)
  },
  getBatch(id) {
    return http.get(`/compensation/batches/${id}`)
  },
  updateBatch(id, data) {
    return http.put(`/compensation/batches/${id}`, data)
  },
  summary(params = {}) {
    return http.get('/compensation/summary', { params })
  },
  getBatchRecords(id) {
    return http.get(`/compensation/batches/${id}/records`)
  },
  updateRecord(recordId, data) {
    return http.put(`/compensation/records/${recordId}`, data)
  },
  recordHistory(recordId) {
    return http.get(`/compensation/records/${recordId}/history`)
  },
  confirmBatch(id) {
    return http.post(`/compensation/batches/${id}/confirm`)
  },
  exportBatch(id) {
    return http.post(`/compensation/batches/${id}/export`)
  },
}
