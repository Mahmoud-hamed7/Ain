import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const apiClient = axios.create({
  // استخدام الـ URL من الـ env لو موجود، غير كده بيستخدم الديفولت
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://4498-197-54-154-143.ngrok-free.app',
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420' // مهم جداً عشان Ngrok ميوقفش الريكويست
  }
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;