import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Course APIs
export const getCourses = (search?: string) => api.get('/courses', { params: search ? { search } : undefined });
export const createCourse = (data: any) => api.post('/courses', data);
export const updateCourse = (courseId: string, data: any) => api.put(`/courses/${courseId}`, data);
export const deleteCourse = (courseId: string) => api.delete(`/courses/${courseId}`);
export const importCSV = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/courses/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const uploadFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/courses/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const getSampleCSV = () => api.get('/courses/sample-csv', { responseType: 'blob' });
export const deleteSampleData = () => api.delete('/courses/sample-data');

// Analysis APIs
export const runSimilarityAnalysis = (params: { method: string; threshold: number }) => api.post('/analysis/similarity', params);
export const getAnalysisHistory = () => api.get('/analysis/history');
export const getAnalysisById = (id: number) => api.get(`/analysis/${id}`);
export const exportAnalysis = (id: number) => api.get(`/analysis/export/${id}`, { responseType: 'blob' });
export const runGapAnalysis = (params: { curriculum_id: number; method?: string }) => api.post('/analysis/gap', params);
export const getRecommendations = (analysisId: number) => api.get(`/analysis/recommendations/${analysisId}`);
export const getNlpStatus = () => api.get('/analysis/status');
export const deleteAnalysis = (id: number) => api.delete(`/analysis/${id}`);

// Curriculum APIs
export const getCurricula = () => api.get('/curricula');
export const createCurriculum = (data: any) => api.post('/curricula', data);
export const updateCurriculum = (id: number, data: any) => api.put(`/curricula/${id}`, data);
export const deleteCurriculum = (id: number) => api.delete(`/curricula/${id}`);

export const healthCheck = () => api.get('/health');

export default api;
