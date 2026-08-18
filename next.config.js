/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// 仓库名为 jiucai → GitHub Pages project page 地址为 https://<user>.github.io/jiucai/
// 仅在生产构建（静态导出）时加 basePath，本地 dev 仍跑在根路径，编辑功能可用。
const basePath = isProd ? '/jiucai' : '';

const nextConfig = {
  reactStrictMode: true,
  // 静态导出：所有页面预渲染为 HTML，可直接托管在 GitHub Pages
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

module.exports = nextConfig;
