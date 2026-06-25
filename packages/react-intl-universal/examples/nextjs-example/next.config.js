/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGithubPages ? '/react-intl-universal' : '';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
}

module.exports = nextConfig
