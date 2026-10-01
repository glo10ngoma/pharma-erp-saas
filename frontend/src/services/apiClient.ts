import axios from 'axios';
import { invalidateAuthSession, isAuthTokenError } from '../auth/authSession';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthTokenError(error)) {
      invalidateAuthSession();
    }
    return Promise.reject(error);
  },
);
