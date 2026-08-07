/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@samren/ui', '@samren/hooks', '@samren/types', '@samren/utils'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'media.kitsu.app' },
      { protocol: 'https', hostname: 'cover.tsfansub.com' },
    ],
  },
};
