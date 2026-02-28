import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@naufarrel/shared': path.resolve(__dirname, '../../packages/shared')
        }
    },
    css: {
        postcss: './postcss.config.js'
    },
    server: {
        port: 5173
    }
})
