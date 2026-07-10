import React from 'react';
import axios from 'axios';

// API base is injected at build time via REACT_APP_API_URL (set in the Render
// static site's env). Falls back to the current prod URL if unset.
export const BASE_URL = process.env.REACT_APP_API_URL || 'https://admin.vershipgo.com/admin';
export const API_URL = process.env.REACT_APP_API_URL || 'https://admin.vershipgo.com/admin';
// Local dev: set REACT_APP_API_URL=http://localhost:8182/admin in client/.env

const axiosInstance = axios.create({
  baseURL: API_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
        localStorage.removeItem('token');
        window.location.replace('/');
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
