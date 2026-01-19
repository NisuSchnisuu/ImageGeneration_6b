/** @type {import('next').NextConfig} */
const nextConfig = {
    // Erlaubt Bilder von externen Quellen (wichtig für die generierten Bilder)
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**', 
            },
        ],
    },
};

module.exports = nextConfig;
