'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSlots, initializeSlots, updateSlot, ImageSlot } from '@/lib/slots';
import Generator from './Generator'; // Wir nutzen den existierenden Generator, passen ihn aber an
import { Folder, FolderOpen, Lock, CheckCircle, Image as ImageIcon, Loader2, ArrowLeft, LogOut } from 'lucide-react';
import Image from 'next/image';

interface StudentDashboardProps {
    user: any;
    onLogout: () => void;
}

export default function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
    const [slots, setSlots] = useState<ImageSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSlot, setActiveSlot] = useState<ImageSlot | null>(null);

    // Initialisierung beim Start
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            // Sicherstellen, dass Slots existieren
            await initializeSlots(user.id);
            // Laden
            const data = await getSlots(user.id);
            setSlots(data);
            setLoading(false);
        };
        load();
    }, [user.id]);

    const handleSlotUpdate = async (imageBase64: string, prompt: string) => {
        if (!activeSlot) return;

        const newAttempts = activeSlot.attempts_used + 1;
        
        try {
            await updateSlot(activeSlot.id, imageBase64, prompt, newAttempts);
            
            // Lokalen State updaten
            setSlots(prev => prev.map(s => 
                s.id === activeSlot.id 
                ? { ...s, last_image_base64: imageBase64, attempts_used: newAttempts, is_locked: newAttempts >= 3 }
                : s
            ));
            
            // Active Slot auch updaten, damit der Zähler im UI stimmt
            setActiveSlot(prev => prev ? {
                ...prev, 
                last_image_base64: imageBase64, 
                attempts_used: newAttempts, 
                is_locked: newAttempts >= 3 
            } : null);

        } catch (err) {
            console.error("Failed to save slot progress", err);
            alert("Fehler beim Speichern des Fortschritts!");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-yellow-500 gap-4">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p>Lade deine Mappe...</p>
            </div>
        );
    }

    // --- VIEW: GENERATOR (Innerhalb eines Slots) ---
    if (activeSlot) {
        return (
            <div className="w-full max-w-4xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4">
                <button 
                    onClick={() => setActiveSlot(null)}
                    className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Zurück zur Übersicht
                </button>

                <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-gray-700 text-sm font-mono">
                        Versuch <span className={activeSlot.attempts_used >= 3 ? "text-red-500" : "text-yellow-500"}>
                            {activeSlot.attempts_used}/3
                        </span>
                    </div>

                    {activeSlot.is_locked ? (
                        <div className="flex flex-col items-center gap-6 py-12">
                            <Lock className="w-16 h-16 text-red-500/50" />
                            <h2 className="text-2xl font-bold text-gray-300">Slot gesperrt</h2>
                            <p className="text-gray-500 max-w-md text-center">
                                Du hast alle 3 Versuche für dieses Bild verbraucht.
                            </p>
                            {activeSlot.last_image_base64 && (
                                <div className="relative w-64 h-64 rounded-xl overflow-hidden border border-gray-700 shadow-2xl mt-4">
                                    <Image 
                                        src={activeSlot.last_image_base64} 
                                        alt="Final Result" 
                                        fill 
                                        className="object-cover"
                                        unoptimized
                                    />
                                    <a 
                                        href={activeSlot.last_image_base64} 
                                        download={`slot-${activeSlot.slot_number}-final.png`}
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity"
                                    >
                                        <span className="bg-white text-black px-4 py-2 rounded-full font-bold">Download</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Hier binden wir den Generator ein. 
                        // WICHTIG: Wir müssen Generator.tsx anpassen, damit er onImageGenerated Callback akzeptiert!
                        // Da ich Generator.tsx nicht ändern will, baue ich hier einen Wrapper oder wir refactorn Generator.
                        // Entscheidung: Ich modifiziere Generator.tsx leicht, damit er "Controlled" genutzt werden kann.
                        <GeneratorWrapper 
                            activeSlot={activeSlot} 
                            onUpdate={handleSlotUpdate}
                        />
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW: ÜBERSICHT (Grid) ---
    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-8">
            <header className="flex justify-between items-center bg-gray-900/50 p-6 rounded-3xl border border-gray-800 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Hallo {user.full_name || 'Künstler'}!</h1>
                    <p className="text-gray-400 text-sm">Wähle einen Slot, um zu beginnen.</p>
                </div>
                <button 
                    onClick={onLogout}
                    className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-gray-300"
                    title="Abmelden"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {slots.map((slot) => (
                    <button
                        key={slot.id}
                        onClick={() => setActiveSlot(slot)}
                        className={`
                            relative group aspect-square rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden
                            ${slot.last_image_base64 
                                ? 'border-gray-700 bg-gray-800 hover:border-yellow-500/50' 
                                : 'border-gray-800 bg-gray-900/30 hover:bg-gray-900 hover:border-gray-700'
                            }
                        `}
                    >
                        {/* Background Image Preview */}
                        {slot.last_image_base64 && (
                            <div className="absolute inset-0 z-0 opacity-40 group-hover:opacity-60 transition-opacity">
                                <Image 
                                    src={slot.last_image_base64} 
                                    alt="Preview" 
                                    fill 
                                    className="object-cover blur-sm group-hover:blur-0 transition-all duration-500" 
                                    unoptimized
                                />
                            </div>
                        )}

                        <div className="z-10 bg-black/50 p-3 rounded-full backdrop-blur-sm border border-white/10 group-hover:scale-110 transition-transform">
                            {slot.is_locked ? (
                                <Lock className="w-6 h-6 text-red-400" />
                            ) : slot.attempts_used > 0 ? (
                                <FolderOpen className="w-6 h-6 text-yellow-400" />
                            ) : (
                                <Folder className="w-6 h-6 text-gray-500 group-hover:text-white" />
                            )}
                        </div>
                        
                        <div className="z-10 flex flex-col items-center">
                            <span className="font-bold text-lg text-white drop-shadow-md">Bild {slot.slot_number}</span>
                            <span className="text-xs font-mono bg-black/60 px-2 py-1 rounded text-gray-300 backdrop-blur-sm">
                                {slot.attempts_used}/3
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Lokaler Wrapper für den Generator, um die Logik zu verbinden
// Hinweis: Da wir Generator.tsx nicht umbauen wollen, kopiere ich hier die wesentliche Logik rein
// oder (besser): Ich passe Generator.tsx im nächsten Schritt an, damit er `onImageGenerated` props akzeptiert.
// Für jetzt mache ich einen Platzhalter, der gleich durch den echten Generator ersetzt wird.
function GeneratorWrapper({ activeSlot, onUpdate }: { activeSlot: ImageSlot, onUpdate: (img: string, prompt: string) => void }) {
    // Wir brauchen hier eine Version des Generators, der das Bild nach oben reicht.
    // Ich werde Generator.tsx gleich modifizieren.
    return (
        <GeneratorWithCallback 
            key={activeSlot.id} // Reset bei Slot-Wechsel
            initialImage={activeSlot.last_image_base64} 
            onGenerate={onUpdate} 
        />
    );
}

import { Send, Download as DownloadIcon, Zap, Crown } from 'lucide-react';

// Angepasster Generator für das Dashboard
function GeneratorWithCallback({ initialImage, onGenerate }: { initialImage: string | null, onGenerate: (img: string, p: string) => void }) {
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(initialImage);
    const [loading, setLoading] = useState(false);
    const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setError(null);
        
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, modelType }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.image) {
                setImage(data.image);
                onGenerate(data.image, prompt); // Speichern in DB
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6">
             {/* Model Selector */}
            <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800 backdrop-blur-sm">
                <button 
                    onClick={() => setModelType('flash')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${modelType === 'flash' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Zap className="w-4 h-4" />
                    <span className="font-medium">Flash</span>
                </button>
                <button 
                    onClick={() => setModelType('pro')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${modelType === 'pro' ? 'bg-orange-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Crown className="w-4 h-4" />
                    <span className="font-medium">Pro</span>
                </button>
            </div>

            <div className="w-full aspect-square bg-black/20 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-800 relative group">
                {loading ? (
                    <div className="flex flex-col items-center gap-2 text-yellow-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span>Generiere...</span>
                    </div>
                ) : image ? (
                    <>
                        <Image src={image} alt="Generated" fill className="object-contain" unoptimized />
                         <a 
                            href={image} 
                            download="bild.png"
                            className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-full transition-all"
                        >
                            <DownloadIcon className="w-6 h-6 text-white" />
                        </a>
                    </>
                ) : (
                    <ImageIcon className="w-16 h-16 text-gray-700" />
                )}
            </div>

            <div className="w-full relative">
                <input 
                    type="text" 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                    placeholder="Beschreibe dein Bild..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 pr-14 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                />
                <button 
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="absolute right-2 top-2 bottom-2 bg-yellow-500 hover:bg-yellow-400 text-black p-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
    );
}
