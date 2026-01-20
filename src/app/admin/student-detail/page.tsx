'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminUnlockSlot, ImageSlot, getSlots } from '@/lib/slots';
import Link from 'next/link';
import {
    ArrowLeft,
    Loader2,
    Lock,
    Unlock,
    Folder,
    FolderOpen,
    MessageSquare,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

function StudentDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [student, setStudent] = useState<any>(null);
    const [slots, setSlots] = useState<ImageSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const load = async () => {
            const { data: studentData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (studentData) {
                setStudent(studentData);
                const slotsData = await getSlots(studentData.id);
                setSlots(slotsData);
            }
            setLoading(false);
        };
        load();
    }, [id]);

    const handleUnlock = async (slot: ImageSlot) => {
        if (!confirm(`Slot ${slot.slot_number} wirklich zurücksetzen? Alle Fortschritte gehen verloren.`)) return;

        try {
            await adminUnlockSlot(slot);
            // Refresh
            const data = await getSlots(id!);
            setSlots(data);
        } catch (err) {
            alert("Fehler beim Entsperren.");
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-screen bg-gray-950 text-yellow-500">
            <Loader2 className="w-10 h-10 animate-spin" />
        </div>
    );

    if (!student) return <div className="p-8 text-white">Schüler nicht gefunden.</div>;

    return (
        <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{student.full_name}</h1>
                        <p className="text-gray-500 text-sm font-mono">{student.access_code}</p>
                    </div>
                </div>

                {/* Slots Grid */}
                <div className="grid gap-6">
                    {slots.map(slot => {
                        const isLocked = slot.is_locked || slot.attempts_used >= 3;
                        const hasPrompts = slot.prompt_history && slot.prompt_history.length > 0;

                        return (
                            <div key={slot.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${isLocked ? 'bg-red-900/20 text-red-500' : 'bg-gray-800 text-yellow-500'}`}>
                                            {isLocked ? <Lock className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold">Mappe {slot.slot_number}</h3>
                                            <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                                <span>Versuche: {slot.attempts_used}/3</span>
                                                {slot.last_image_base64 && <span className="text-green-400">• Bilder vorhanden</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isLocked && (
                                            <button
                                                onClick={() => handleUnlock(slot)}
                                                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors border border-gray-700"
                                            >
                                                <Unlock className="w-3 h-3" />
                                                Freigeben
                                            </button>
                                        )}

                                        {hasPrompts && (
                                            <button
                                                onClick={() => setExpandedSlot(expandedSlot === slot.id ? null : slot.id)}
                                                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                                            >
                                                {expandedSlot === slot.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Prompt History & Details */}
                                {expandedSlot === slot.id && hasPrompts && (
                                    <div className="bg-black/30 border-t border-gray-800 p-4 space-y-3">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                            <MessageSquare className="w-3 h-3" />
                                            Prompt Historie
                                        </h4>
                                        <ul className="space-y-2">
                                            {slot.prompt_history.map((prompt, idx) => (
                                                <li key={idx} className="text-sm text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                                                    <span className="text-gray-500 text-xs mr-2 font-mono">#{idx + 1}</span>
                                                    {prompt}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}

export default function StudentDetail() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen bg-gray-950 text-yellow-500"><Loader2 className="w-10 h-10 animate-spin" /></div>}>
            <StudentDetailContent />
        </Suspense>
    );
}
