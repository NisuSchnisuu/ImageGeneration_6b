/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    // Erlaubt Bilder von externen Quellen (wichtig für die generierten Bilder)
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

module.exports = nextConfig;
