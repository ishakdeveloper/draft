import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@draft/shared"],
  poweredByHeader: false,
};

export default config;
