
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@azure/msal-browser', '@azure/msal-react'],
};

module.exports = nextConfig;
