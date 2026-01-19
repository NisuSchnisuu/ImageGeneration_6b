-- 1. Tabellen-Struktur
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    access_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.image_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    slot_number INTEGER CHECK (slot_number >= 1 AND slot_number <= 15) NOT NULL,
    attempts_used INTEGER DEFAULT 0 CHECK (attempts_used >= 0 AND attempts_used <= 3) NOT NULL,
    last_image_base64 TEXT,
    last_prompt TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, slot_number)
);

-- 2. Sicherheit (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_slots ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Profile: Admins dürfen alles, User nur sich selbst sehen
DO $$ BEGIN
    CREATE POLICY "Admins manage all profiles" ON public.profiles FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
    CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT USING (
        auth.uid() = id
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Slots: User verwalten eigene Slots, Admins alle
DO $$ BEGIN
    CREATE POLICY "Users manage own slots" ON public.image_slots FOR ALL USING (
        auth.uid() = user_id
    );
    CREATE POLICY "Admins manage all slots" ON public.image_slots FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
