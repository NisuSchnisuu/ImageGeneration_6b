const keys = require('./keys.json');

const FUNCTION_URL = "http://127.0.0.1:54321/functions/v1/bild-generieren";

async function testGen() {
    console.log("--- Testing Image Gen (Diagnosing 500 Error) ---");

    const payload = {
        prompt: "Ein kleiner Test",
        slotNumber: 0,
        aspectRatio: "1:1"
    };

    try {
        const res = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${keys.ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log(`Response Status: ${res.status}`);
        const text = await res.text();
        const fs = require('fs');
        fs.writeFileSync('test_output.txt', text);
        console.log("Output written to test_output.txt");

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testGen();
