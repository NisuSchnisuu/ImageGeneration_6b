const jwt = require('jsonwebtoken');

const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

const anonPayload = {
    "role": "anon",
    "iss": "supabase-demo",
    "exp": 2000000000,
    "ref": "imgernano-repo"
};

const servicePayload = {
    "role": "service_role",
    "iss": "supabase-demo",
    "exp": 2000000000,
    "ref": "imgernano-repo"
};

const fs = require('fs');

const anonKey = jwt.sign(anonPayload, SECRET, { algorithm: 'HS256' });
const serviceKey = jwt.sign(servicePayload, SECRET, { algorithm: 'HS256' });

fs.writeFileSync('keys.json', JSON.stringify({ ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceKey }, null, 2));
console.log("Keys written to keys.json");
