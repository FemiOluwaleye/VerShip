import axios from 'axios';

// API base is injected at build time via VITE_API_URL (set in the Render static
// site's env). Falls back to the current prod URL if unset.
// Local dev: set VITE_API_URL=http://localhost:8182 in website/.env
export const API_URL = import.meta.env.VITE_API_URL || 'https://admin.vershipgo.com';
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
            const homePath = window.location.pathname.includes("/dev/shipone/website/dist")
                ? "/dev/shipone/website/dist/"
                : "/";
            window.location.href = homePath;
        }
        return Promise.reject(error);
    }
);

export default instance;
