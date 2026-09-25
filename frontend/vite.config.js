import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // A production build without an API URL would silently call http://localhost:5000 from users' browsers.
  if (command === 'build' && !env.VITE_API_URL) {
    throw new Error('VITE_API_URL must be set for production builds (e.g. https://your-api.onrender.com).');
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
    css: { modules: { localsConvention: 'camelCaseOnly' } },
  };
});
