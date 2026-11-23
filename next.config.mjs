/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'exceljs'],
  // Dispute evidence: up to 3 files, 4 MB together, sent through a server action (default limit 1 MB).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
};

export default nextConfig;
