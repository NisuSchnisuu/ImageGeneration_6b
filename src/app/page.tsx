'use client';

import Link from 'next/link';

import { useState, useEffect, Suspense } from 'react';
import { QrCode, Key, Loader2, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import StudentDashboard from '@/components/StudentDashboard';
import QrScanner from '@/components/QrScanner';
import { supabase } from '@/lib/supabase';

// Wir lagern die URL-Logik in eine Child-Komponente aus, um Suspense Warnungen zu vermeiden
function AutoLoginHandler({ user, loading, onAutoLogin }: { user: any, loading: boolean, onAutoLogin: (code: string) => void }) {
  // Client-side only check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const codeFromUrl = params.get('code');
      if (codeFromUrl && !user && !loading) {
        onAutoLogin(codeFromUrl);
      }
    }
  }, [user, loading, onAutoLogin]);
  return null;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shortcut für Admin Login: Alt + Shift + L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'L') {
        setShowAdminLogin(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prüfen, ob bereits eingeloggt
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser({ ...session.user, user_role: profile?.role, ...profile });
      }
      setIsInitializing(false);
    };
    checkUser();
  }, []);

  const handleAutoLogin = (code: string) => {
    setAccessCode(code);
    handleStudentLogin(code);
  };

  const handleStudentLogin = async (overrideCode?: string) => {
    const codeToUse = overrideCode || accessCode;
    if (!codeToUse.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const email = `${codeToUse.toUpperCase()}@student.local`;
      const password = codeToUse.toUpperCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw new Error('Ungültiger Code.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      setUser({ ...data.user, user_role: profile?.role, ...profile });

      // URL cleanen falls nötig
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      setUser({ ...data.user, user_role: profile?.role, ...profile });
      setShowAdminLogin(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // --- VIEW LOGIC ---

  if (user) {
    if (user.user_role === 'admin' || user.user_role === 'admin_2') {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-black text-white relative">
          <div className="z-10 text-center space-y-6">
            <h1 className="text-3xl font-bold text-yellow-500">
              Hallo Admin!
              {user.user_role === 'admin_2' && <span className="ml-2 text-sm bg-gray-800 text-gray-400 px-2 py-1 rounded-full uppercase tracking-wider border border-gray-700">Read Only</span>}
            </h1>
            <div className="flex gap-4">
              <Link href="/admin" className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Zum Dashboard
              </Link>
              <button onClick={handleLogout} className="bg-gray-800 text-white px-6 py-3 rounded-xl hover:bg-gray-700">
                Abmelden
              </button>
            </div>
          </div>
        </main>
      );
    }

    // HIER IST DIE ÄNDERUNG: StudentDashboard statt Generator
    return (
      <main className="min-h-screen bg-black text-white relative overflow-y-auto">
        <div className="fixed top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-50 z-0 pointer-events-none" />
        <div className="relative z-10">
          <StudentDashboard user={user} onLogout={handleLogout} />
        </div>
      </main>
    );
  }

  // Login Screen
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white relative overflow-hidden">
      <Suspense fallback={null}>
        <AutoLoginHandler user={user} loading={loading} onAutoLogin={handleAutoLogin} />
      </Suspense>

      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black opacity-50 z-0 pointer-events-none" />

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-block p-4 bg-yellow-500/10 rounded-3xl border border-yellow-500/20 mb-2">
            <ImageIcon className="w-12 h-12 text-yellow-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Nano Banana</h1>
          <p className="text-gray-400">Gib deinen Zugangscode ein, um zu starten.</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              placeholder="DEIN-CODE-123"
              className="w-full bg-gray-900/50 border border-gray-800 text-white text-center text-xl font-mono rounded-2xl px-6 py-5 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 placeholder-gray-700 transition-all"
            />
          </div>

          <button
            onClick={() => handleStudentLogin()}
            disabled={loading || !accessCode.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-5 rounded-2xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Key className="w-6 h-6" />}
            Anmelden
          </button>

          <div className="relative py-4 flex items-center">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="flex-shrink mx-4 text-gray-600 text-sm uppercase tracking-widest">Oder</span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          <button
            onClick={() => setShowQrScanner(true)}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-medium py-5 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <QrCode className="w-6 h-6" />
            QR-Code scannen
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-sm text-center animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-gray-600 pt-8">
          Pass auf deine Codes gut auf. Viel Spaß beim Erstellen!
        </p>
      </div>

      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-yellow-500">
              <ShieldCheck className="w-8 h-8" />
              <h2 className="text-xl font-bold">Admin-Login</h2>
            </div>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="E-Mail"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 outline-none"
              />
              <input
                type="password"
                placeholder="Passwort"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 outline-none"
              />
              <button
                onClick={handleAdminLogin}
                disabled={loading}
                className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Login'}
              </button>
              <button
                onClick={() => setShowAdminLogin(false)}
                className="w-full text-gray-500 text-sm hover:text-white transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrScanner && (
        <QrScanner
          onScanSuccess={(code) => {
            setAccessCode(code);
            setShowQrScanner(false);
            handleStudentLogin(code);
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </main>
  );
}