/** @type {import('next').NextConfig} */
const nextConfig = {
  // required by the Dockerfile's standalone runner stage
  output: "standalone",
  reactCompiler: true,
  async redirects() {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN === "false"
    ) {
      return [
        {
          source: "/login",
          destination: "/login/microsoft",
          permanent: false,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;