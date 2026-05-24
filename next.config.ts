import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone is needed for Docker; Vercel handles its own output optimisation
  output: process.env.VERCEL ? undefined : 'standalone',
  // better-sqlite3 is in Next.js's built-in serverExternalPackages list, but
  // @vercel/nft won't trace the native .node binary because it's loaded
  // dynamically via bindings — force it into the deployment bundle.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/better-sqlite3/build/Release/*.node'],
  },
}

export default nextConfig