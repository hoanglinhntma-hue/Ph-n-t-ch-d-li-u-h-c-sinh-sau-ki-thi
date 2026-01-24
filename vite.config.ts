
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Đảm bảo process.env có sẵn cho Gemini SDK
    'process.env': process.env
  }
});
