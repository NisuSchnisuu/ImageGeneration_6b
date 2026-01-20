
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Check for auto-injected key first, then user-defined fallback
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
        const url = Deno.env.get('SUPABASE_URL'); // Or NEXT_PUBLIC_SUPABASE_URL if passed, but usually env var in Function

        if (!serviceKey || !url) {
            throw new Error("Missing Server Configuration");
        }

        const supabaseAdmin = createClient(url, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { name, accessCode } = await req.json();

        if (!name || !accessCode) {
            return new Response(JSON.stringify({ error: 'Name und Code fehlen' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const email = `${accessCode}@student.local`;
        const password = accessCode;

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

        if (error) throw error;

        // Trigger should handle profile creation, but if we wanted to be sure:
        // ... logic from route.ts ...
        // The previous route had profile update logic, but the trigger `handle_new_user` handles profile creation.
        // The previous route did an update:
        // .update({ access_code: accessCode, role: 'student' })
        // The trigger ALREADY sets these from metadata. So we likely don't need the extra update if the trigger works.
        // I'll skip the extra update to keep it simple, relying on the trigger.

        return new Response(JSON.stringify({ success: true, user: data.user }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
