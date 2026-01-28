'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Users,
    UserPlus,
    QrCode,
    Trash2,
    ChevronLeft,
    Loader2,
    ShieldCheck,
    Download,
    Eye,
    Lock,
    Unlock,
    Activity,
    FileText
} from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

export default function AdminDashboard() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [newStudentName, setNewStudentName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedQr, setSelectedQr] = useState<{ name: string, url: string } | null>(null);
    const [isGlobalLocked, setIsGlobalLocked] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        fetchStudents();
        fetchSettings();

        // Realtime: Active Status & Settings
        const channel = supabase
            .channel('admin_dashboard')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
                setStudents(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
                setIsGlobalLocked(payload.new.login_locked);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
                setStudents(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('login_locked').single();
        if (data) setIsGlobalLocked(data.login_locked);
    };

    const fetchStudents = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .order('created_at', { ascending: false });

        if (error) setError(error.message);
        else setStudents(data || []);
        setLoading(false);
    };

    const generateCode = () => {
        // Format: XXXX-XXXX-XXXX
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const segment = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        return `${segment()}-${segment()}-${segment()}`;
    };

    const addStudent = async () => {
        if (!newStudentName.trim()) return;
        setActionLoading(true);
        setError(null);

        const accessCode = generateCode();

        try {
            const { data, error: funcError } = await supabase.functions.invoke('admin-create-student', {
                body: {
                    name: newStudentName,
                    accessCode: accessCode
                },
                // Force use of ANON_KEY (HS256) ONLY in local development to bypass Invalid JWT issue
                // In production, undefined headers means Supabase uses the user's session token automatically
                headers: process.env.NODE_ENV === 'development' ? {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
                } : undefined
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            setNewStudentName('');
            // fetchStudents handled by realtime, but safety fetch:
            fetchStudents();
        } catch (err: any) {
            setError("Fehler: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const toggleGlobalLock = async () => {
        const newState = !isGlobalLocked;
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ login_locked: newState })
                .eq('id', 1); // Assuming ID 1 is the singleton row
            if (error) throw error;
            setIsGlobalLocked(newState);
        } catch (err: any) {
            alert("Fehler beim Ändern des Status: " + err.message);
        }
    };

    const generatePdf = async () => {
        setGeneratingPdf(true);
        try {
            const doc = new jsPDF();
            let y = 20;

            doc.setFontSize(20);
            doc.text("Zugangscodes - Nano Banana", 105, y, { align: 'center' });
            y += 20;

            for (let i = 0; i < students.length; i++) {
                const s = students[i];
                if (y > 250) {
                    doc.addPage();
                    y = 20;
                }

                doc.setFontSize(12);
                doc.text(`Name: ${s.full_name}`, 20, y);
                doc.text(`Code: ${s.access_code}`, 20, y + 7);

                // Generate QR
                const path = window.location.pathname;
                const basePath = path.substring(0, path.lastIndexOf('/admin'));
                const loginUrl = `${window.location.origin}${basePath}/?code=${s.access_code}`;
                const qrDataUrl = await QRCode.toDataURL(loginUrl, { margin: 1 });

                doc.addImage(qrDataUrl, 'PNG', 150, y - 5, 30, 30);

                // Line
                doc.setDrawColor(200);
                doc.line(20, y + 30, 190, y + 30);

                y += 40;
            }

            doc.save('zugangscodes.pdf');
        } catch (err) {
            console.error(err);
            alert("PDF Fehler");
        } finally {
            setGeneratingPdf(false);
        }
    };

    const deleteStudent = async (id: string) => {
        if (!confirm('Schüler wirklich löschen? Alle Bilder gehen verloren.')) return;

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) setError(error.message);
        // Realtime usually handles removal if we listened to DELETE, but let's re-fetch to be safe
        else fetchStudents();
    };

    const showQr = async (student: any) => {
        try {
            const path = window.location.pathname;
            const basePath = path.substring(0, path.lastIndexOf('/admin'));
            const loginUrl = `${window.location.origin}${basePath}/?code=${student.access_code}`;

            const url = await QRCode.toDataURL(loginUrl, { width: 300, margin: 2 });
            setSelectedQr({ name: student.full_name, url });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-800 rounded-full transition-colors">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <ShieldCheck className="text-yellow-500" />
                                Admin Dashboard
                            </h1>
                            <p className="text-gray-500 text-sm">Verwalte deine Klasse</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={toggleGlobalLock}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isGlobalLocked ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-green-400'}`}
                        >
                            {isGlobalLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {isGlobalLocked ? 'System GESPERRT' : 'System OFFEN'}
                        </button>

                        <button
                            onClick={generatePdf}
                            disabled={generatingPdf}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            PDF Export
                        </button>
                    </div>
                </div>

                {/* Add Student Form */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-yellow-500" />
                        Neuen Schüler hinzufügen
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Name des Schülers (z.B. Max Mustermann)"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            className="flex-grow bg-black border border-gray-800 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                        <button
                            onClick={addStudent}
                            disabled={actionLoading || !newStudentName}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                            Hinzufügen
                        </button>
                    </div>
                </div>

                {/* Students List */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="w-5 h-5 text-yellow-500" />
                            Schülerliste ({students.length})
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-black/50 text-gray-500 text-xs uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Name</th>
                                    <th className="px-6 py-4 font-medium">Zugangscode</th>
                                    <th className="px-6 py-4 font-medium text-right">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-700" />
                                        </td>
                                    </tr>
                                ) : students.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-600">
                                            Noch keine Schüler angelegt.
                                        </td>
                                    </tr>
                                ) : (
                                    students.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                {student.is_generating ? (
                                                    <div className="flex items-center gap-2 text-green-400 animate-pulse font-bold text-xs uppercase tracking-wide">
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Aktiv
                                                    </div>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-gray-700 mx-2" />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-medium">{student.full_name}</td>
                                            <td className="px-6 py-4">
                                                <code className="bg-black px-3 py-1 rounded text-yellow-500 font-mono text-sm tracking-wider">
                                                    {student.access_code}
                                                </code>
                                            </td>
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <Link
                                                    href={`/admin/student-detail?id=${student.id}`}
                                                    className="inline-flex p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors align-middle"
                                                    title="Details & Slots"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </Link>
                                                <button
                                                    onClick={() => showQr(student)}
                                                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                    title="QR-Code anzeigen"
                                                >
                                                    <QrCode className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteStudent(student.id)}
                                                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* QR Modal */}
            {selectedQr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedQr(null)}>
                    <div className="bg-white p-6 rounded-3xl max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-black font-bold text-xl">{selectedQr.name}</h3>
                        <img src={selectedQr.url} alt="QR Code" className="w-full h-auto mx-auto" />
                        <p className="text-gray-900 font-mono text-lg tracking-widest break-all">{selectedQr.name}</p>
                        <button
                            onClick={() => setSelectedQr(null)}
                            className="bg-gray-900 text-white w-full py-3 rounded-xl font-bold hover:bg-black transition-colors"
                        >
                            Schließen
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}