import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        define: {
            'process.env.REACT_APP_BASE_URL': JSON.stringify(env.REACT_APP_BASE_URL),
            'process.env': env
        },
        server: {
            host: true,
            port: 5173,
        },
    }
})
