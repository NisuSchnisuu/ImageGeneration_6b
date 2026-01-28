const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDk5NTg5Nn0.TV0nhkSniMoIvHOw5QhhcEJqFER1_cKjTCVCXkzFG2YMJI0UueRUjDk3CWBpasGFnchUktTmJeMNJwKDwoWphA"; // SERVICE ROLE KEY

async function test() {
    console.log("--- Testing Local Supabase Connectivity ---\n");

    // 1. Auth Health
    process.stdout.write("Checking Auth Service... ");
    try {
        const auth = await fetch(`${SUPABASE_URL}/auth/v1/health`);
        if (auth.ok) console.log("✅ OK");
        else console.log(`❌ Failed (${auth.status})`);
    } catch (e) { console.log(`❌ Error: ${e.message}`); }

    // 2. Edge Function: Bild Generieren (Simple check)
    // We expect a "Prompt is required" or valid response, or 200 with error if handled.
    process.stdout.write("Checking 'bild-generieren' Function... ");
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/bild-generieren`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: "Test Check", slotNumber: 0 }) // Valid prompt
        });

        // The function might return 200 even on logical error (as per code).
        const data = await res.json();
        if (res.ok) {
            console.log("✅ OK (Reachable)");
            console.log("   Response Preview:", JSON.stringify(data).substring(0, 100) + "...");
        } else {
            console.log(`❌ Failed Status (${res.status})`);
            console.log("   Body:", data);
        }
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
        console.log("   (If this failed, the Edge Function container might not be running)");
    }
}

test();
