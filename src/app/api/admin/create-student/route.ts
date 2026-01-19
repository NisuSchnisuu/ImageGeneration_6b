import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        console.log("Create Student API called");
        
        // ENV Check
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !url) {
            console.error("Missing ENV variables for Supabase Admin");
            return NextResponse.json(
                { error: "Server Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY" }, 
                { status: 500 }
            );
        }

        // Admin Client initialisieren
        const supabaseAdmin = createClient(url, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { name, accessCode } = await req.json();
        console.log("Creating user:", name, accessCode);

        if (!name || !accessCode) {
            return NextResponse.json({ error: 'Name und Code fehlen' }, { status: 400 });
        }

        const email = `${accessCode}@student.local`;
        const password = accessCode;

        // User erstellen
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                role: 'student',
                access_code: accessCode
            }
        });

        if (error) {
            console.error("Supabase Create User Error:", error);
            throw error;
        }

        console.log("User created successfully:", data.user?.id);

        // Profil Update (optional, da Trigger das meistens macht)
        if (data.user) {
             const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ access_code: accessCode, role: 'student' })
                .eq('id', data.user.id);
                
             if (profileError) console.error("Profile update error:", profileError);
        }

        return NextResponse.json({ success: true, user: data.user });

    } catch (error: any) {
        console.error("Create Student API Critical Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}