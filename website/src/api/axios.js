import axios from 'axios';

// Single-service app: the API is served same-origin, so the base is relative by
// default (calls like /website/login hit this same server). VITE_API_URL can
// override it (e.g. pointing a local frontend dev server at a remote API).
export const API_URL = import.meta.env.VITE_API_URL || '';
const instance = axios.create({
    baseURL: API_URL,
});

instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            console.log("Attaching token to request:", token);
            config.headers.Authorization = `Bearer ${token}`;
        } else {
            console.log("No token found in localStorage");
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

instance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 402) {
            const message = error.response.data?.message || "Session expired - please log in again.";
            localStorage.clear();
            localStorage.setItem("deactivationMsg", message);
            window.location.href = "/";
        }
        return Promise.reject(error);
    }
);

export default instance;
