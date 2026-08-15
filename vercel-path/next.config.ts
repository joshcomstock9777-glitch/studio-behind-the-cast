import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true
  }
};

export default withWorkflow(nextConfig);
