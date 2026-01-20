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
    Eye
} from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function AdminDashboard() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [newStudentName, setNewStudentName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedQr, setSelectedQr] = useState<{ name: string, url: string } | null>(null);

    useEffect(() => {
        fetchStudents();
    }, []);

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
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
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
                }
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            setNewStudentName('');
            fetchStudents();
        } catch (err: any) {
            setError("Fehler: " + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const deleteStudent = async (id: string) => {
        if (!confirm('Schüler wirklich löschen? Alle Bilder gehen verloren.')) return;

        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) setError(error.message);
        else fetchStudents();
    };

    const showQr = async (student: any) => {
        try {
            // Wir bauen die volle URL für den automatischen Login
            // Wir müssen 'window.location.pathname' nutzen, um auch Projekt-Unterordner (GitHub Pages) zu unterstützen
            const path = window.location.pathname; // z.B. "/repo-name/admin" oder "/admin"
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
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <ShieldCheck className="text-yellow-500" />
                                Admin Dashboard
                            </h1>
                            <p className="text-gray-500 text-sm">Verwalte deine Klasse und Zugangscodes</p>
                        </div>
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
                                    <th className="px-6 py-4 font-medium">Name</th>
                                    <th className="px-6 py-4 font-medium">Zugangscode</th>
                                    <th className="px-6 py-4 font-medium text-right">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-700" />
                                        </td>
                                    </tr>
                                ) : students.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-gray-600">
                                            Noch keine Schüler angelegt.
                                        </td>
                                    </tr>
                                ) : (
                                    students.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-800/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{student.full_name}</td>
                                            <td className="px-6 py-4">
                                                <code className="bg-black px-3 py-1 rounded text-yellow-500 font-mono text-lg">
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
                        <p className="text-gray-900 font-mono text-2xl tracking-widest">{selectedQr.name}</p>
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