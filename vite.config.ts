import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` must match how the app is served.
// - Custom domain (my.unforced.org) or user/org page: '/'
// - GitHub Pages project site (username.github.io/my-vault-ui/): '/my-vault-ui/'
// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
})
