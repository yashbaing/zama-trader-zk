/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Handle WebAssembly files (e.g., tfhe_bg.wasm from fhevmjs)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Add rule to emit wasm files as assets
    config.module.rules.push({
      test: /\.wasm$/i,
      type: 'webassembly/async',
    });

    // Alias fhevmjs to our local shim to avoid wasm resolution errors
    config.resolve.alias = {
      ...config.resolve.alias,
      fhevmjs: path.resolve(__dirname, 'src/lib/fhevm-shim.ts'),
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: false,
      stream: false,
      buffer: false,
    };

    return config;
  },
};

module.exports = nextConfig;
