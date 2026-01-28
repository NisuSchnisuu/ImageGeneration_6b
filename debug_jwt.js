const jwt = require('jsonwebtoken');

const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const FUNCTION_URL = "http://127.0.0.1:54321/functions/v1/admin-create-student";

function signJWT(payload, secret) {
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

async function test() {
    console.log("Generating HS256 Token...");
    const payload = {
        "iss": "supabase-demo",
        "role": "service_role", // Try service_role first
        "exp": Math.floor(Date.now() / 1000) + 3600,
        "sub": "test-admin",
        "app_metadata": { "provider": "email" },
        "user_metadata": {}
    };

    const token = signJWT(payload, SECRET);
    console.log("Token:", token);

    console.log("\nCalling Function...");
    try {
        const res = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name: "Debug User", accessCode: "DEBUG-123" })
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

test();
