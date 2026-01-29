'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminUnlockSlot, ImageSlot, getSlots, forceDeleteSlotImages, getMaxAttempts, adminLockSlot } from '@/lib/slots';
import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowLeft,
    Loader2,
    Lock,
    Unlock,
    Folder,
    FolderOpen,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    Activity,
    ImageIcon,
    Trash2,
    Ghost
} from 'lucide-react';

function StudentDetailContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');

    const [student, setStudent] = useState<any>(null);
    const [slots, setSlots] = useState<ImageSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;

        const load = async () => {
            // Initial Load
            await fetchData();
            await fetchCurrentUser();

            // Realtime Updates
            const channel = supabase
                .channel(`student_detail_${id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${id}` }, (payload) => {
                    setStudent((prev: any) => ({ ...prev, ...payload.new }));
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'image_slots', filter: `user_id=eq.${id}` }, () => {
                    fetchSlots();
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        };
        load();
    }, [id]);

    const fetchCurrentUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            setCurrentUserRole(profile?.role || null);
        }
    };

    const fetchData = async () => {
        const { data: studentData } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (studentData) {
            setStudent(studentData);
            await fetchSlots();
        }
        setLoading(false);
    };

    const fetchSlots = async () => {
        if (!id) return;
        const slotsData = await getSlots(id);
        setSlots(slotsData);
    };

    const handleUnlock = async (slot: ImageSlot) => {
        if (currentUserRole !== 'admin') return; // Restriction
        if (!confirm(`Slot ${slot.slot_number} wirklich zurücksetzen? Alle Fortschritte gehen verloren.`)) return;

        try {
            await adminUnlockSlot(slot);
            fetchSlots();
        } catch (err) {
            alert("Fehler beim Entsperren.");
        }
    };

    const handleTrash = async (slot: ImageSlot) => {
        if (currentUserRole !== 'admin') return; // Restriction
        if (!confirm(`Bilder in Slot ${slot.slot_number} wirklich löschen?`)) return;
        try {
            await forceDeleteSlotImages(slot);
            fetchSlots();
        } catch (err) {
            alert("Fehler beim Löschen.");
        }
    };

    const handleLock = async (slot: ImageSlot) => {
        if (currentUserRole !== 'admin') return; // Restriction
        if (!confirm(`Slot ${slot.slot_number} sperren? Der Schüler kann dann nichts mehr ändern.`)) return;
        try {
            await adminLockSlot(slot);
            fetchSlots();
        } catch (err) {
            alert("Fehler beim Sperren.");
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-3">
                                {student.full_name}
                                {student.is_generating && (
                                    <span className="text-green-400 bg-green-900/20 border border-green-900/50 px-3 py-1 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-2 animate-pulse">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Generiert...
                                    </span>
                                )}
                            </h1>
                            <p className="text-gray-500 text-sm font-mono mt-1">Code: {student.access_code}</p>
                        </div>
                    </div>
                </div>

                {/* Slots Grid */}
                <div className="grid gap-6">
                    {slots.map(slot => {
                        const maxAttempts = getMaxAttempts(slot.slot_number);
                        const isLocked = slot.is_locked || slot.attempts_used >= maxAttempts;
                        const hasPrompts = slot.prompt_history && slot.prompt_history.length > 0;
                        const hasImages = slot.history_urls && slot.history_urls.length > 0;

                        const isTitleSlot = slot.slot_number === 0;
                        const isCharacterSlot = slot.slot_number === 1;
                        const remainingMappeNumber = slot.slot_number - 1;

                        return (
                            <div key={slot.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden transition-all hover:border-gray-700">
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-4 rounded-xl ${isLocked
                                            ? 'bg-red-900/10 text-red-500 border border-red-900/20'
                                            : isTitleSlot
                                                ? 'bg-purple-900/20 text-purple-400 border border-purple-900/30'
                                                : isCharacterSlot
                                                    ? 'bg-green-900/20 text-green-400 border border-green-900/30'
                                                    : 'bg-gray-800 text-yellow-500 border border-gray-700'
                                            }`}>
                                            {isLocked ? <Lock className="w-6 h-6" /> : isTitleSlot ? <ImageIcon className="w-6 h-6" /> : isCharacterSlot ? <Ghost className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg flex items-center gap-2">
                                                {isTitleSlot ? 'Titelbild' : isCharacterSlot ? 'Charakter' : `Mappe ${remainingMappeNumber}`}
                                                {isLocked && <span className="text-red-500 text-xs px-2 py-0.5 rounded-full bg-red-900/20 border border-red-900/30 uppercase tracking-wider">Geschlossen</span>}
                                            </h3>
                                            <div className="flex gap-4 text-xs text-gray-400 mt-1 font-medium">
                                                <span>Versuche: <span className={slot.attempts_used >= maxAttempts ? 'text-red-500' : 'text-white'}>{slot.attempts_used}/{maxAttempts}</span></span>
                                                {hasImages && <span className="text-green-400 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {slot.history_urls.length} Bilder</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {isLocked && (
                                            <>
                                                {currentUserRole === 'admin' && (
                                                    <button
                                                        onClick={() => handleTrash(slot)}
                                                        className="p-2 bg-red-900/10 hover:bg-red-900/20 rounded-xl text-red-500 transition-colors border border-red-900/30 mr-2"
                                                        title="Bilder endgültig löschen"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {currentUserRole === 'admin' && (
                                                    <button
                                                        onClick={() => handleUnlock(slot)}
                                                        className="flex items-center gap-2 bg-red-900/10 hover:bg-red-900/20 px-4 py-2 rounded-xl text-xs font-bold text-red-400 transition-colors border border-red-900/30"
                                                    >
                                                        <Unlock className="w-3 h-3" />
                                                        Entsperren
                                                    </button>
                                                )}
                                            </>
                                        )}

                                        {!isLocked && currentUserRole === 'admin' && (
                                            <button
                                                onClick={() => handleLock(slot)}
                                                className="flex items-center gap-2 bg-yellow-900/10 hover:bg-yellow-900/20 px-4 py-2 rounded-xl text-xs font-bold text-yellow-500 transition-colors border border-yellow-900/30"
                                            >
                                                <Lock className="w-3 h-3" />
                                                Sperren
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setExpandedSlot(expandedSlot === slot.id ? null : slot.id)}
                                            className={`p-2 rounded-xl transition-colors ${expandedSlot === slot.id ? 'bg-gray-800 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
                                        >
                                            {expandedSlot === slot.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details: Images & Prompts */}
                                {expandedSlot === slot.id && (
                                    <div className="bg-black/20 border-t border-gray-800 p-6 space-y-8 animate-in slide-in-from-top-2">

                                        {/* Gallery */}
                                        {hasImages ? (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                                    <ImageIcon className="w-3 h-3" />
                                                    Gespeicherte Entwürfe
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                                    {slot.history_urls.map((url, idx) => (
                                                        <a href={url} target="_blank" rel="noreferrer" key={idx} className="relative aspect-square bg-black rounded-lg overflow-hidden border border-gray-800 hover:border-yellow-500 transition-colors group">
                                                            <Image src={url} alt={`Entwurf ${idx + 1}`} fill className="object-contain" unoptimized />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <span className="text-xs font-bold bg-black/80 px-2 py-1 rounded text-white">Öffnen</span>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-600 italic text-sm border-2 border-dashed border-gray-800 rounded-xl">Keine Bilder vorhanden.</div>
                                        )}

                                        {/* Prompts */}
                                        {hasPrompts && (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                                    <MessageSquare className="w-3 h-3" />
                                                    Prompt Historie
                                                </h4>
                                                <ul className="space-y-2">
                                                    {slot.prompt_history.map((prompt, idx) => (
                                                        <li key={idx} className="text-sm text-gray-300 bg-gray-800/40 p-4 rounded-xl border border-gray-800 flex gap-4">
                                                            <span className="text-gray-600 font-mono text-xs mt-0.5">#{idx + 1}</span>
                                                            <span className="leading-relaxed">{prompt}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
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
