import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone is needed for Docker; Vercel handles its own output optimisation
  output: process.env.VERCEL ? undefined : 'standalone',
}

export default nextConfig