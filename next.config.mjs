import withPWA from 'next-pwa';
import runtimeCaching from 'next-pwa/cache.js';

const isDev = process.env.NODE_ENV === 'development';

const nextConfig = withPWA({
  dest: 'public',
  disable: isDev,
  runtimeCaching,
  buildExcludes: [/middleware-manifest.json$/],
  register: true,
  skipWaiting: true,
  sw: 'sw.js',
  clientsClaim: true,
  skipWaiting: true,
});

export default nextConfig;
