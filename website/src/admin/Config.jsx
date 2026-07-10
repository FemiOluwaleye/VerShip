import React from 'react';
import axios from 'axios';

// Single-service app: the admin API and the frontend are same-origin.
// API_URL is the axios base for admin API calls (mounted at /api/admin on the
// server); BASE_URL is the prefix for uploaded file/image URLs (served by the
// /admin/images static mount). Both are overridable via Vite env for flexibility.
export const BASE_URL = import.meta.env.VITE_ADMIN_FILE_URL || '/admin';
export const API_URL = import.meta.env.VITE_ADMIN_API_URL || '/api/admin';

const axiosInstance = axios.create({
  baseURL: API_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;

      if (status === 401) {
        localStorage.removeItem('admin_token');
        window.location.replace('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

const Config = () => {
  return (
    <>
      <p>Base URL: {BASE_URL}</p>
    </>
  );
};

export { Config, axiosInstance };
