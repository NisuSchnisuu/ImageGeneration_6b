'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
    getSlots, 
    initializeSlots, 
    updateSlotWithUrl, 
    uploadImage, 
    clearSlotImagesOnly,
    ImageSlot 
} from '@/lib/slots';
import { compressImage, fileToBase64, urlToBase64 } from '@/lib/imageUtils';
import { 
    Folder, 
    Lock, 
    Image as ImageIcon, 
    Loader2, 
    ArrowLeft, 
    LogOut, 
    Send, 
    Download, 
    Crown, 
    Upload, 
    X, 
    Maximize2, 
    RefreshCw,
    AlertTriangle,
    Eye
} from 'lucide-react';
import Image from 'next/image';

export default function StudentDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
    const [slots, setSlots] = useState<ImageSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSlot, setActiveSlot] = useState<ImageSlot | null>(null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await initializeSlots(user.id);
            const data = await getSlots(user.id);
            setSlots(data);
            setLoading(false);
        };
        load();
    }, [user.id]);

    const requestBack = () => {
        // Szenario B: Slot noch aktiv (< 3 Versuche) -> Einfach zurück, alles behalten
        if (!activeSlot || activeSlot.attempts_used < 3) {
            setActiveSlot(null);
            // Reload slots to get fresh state
            getSlots(user.id).then(setSlots);
            return;
        }
        
        // Szenario A: Slot voll -> Warnung vor finalem Löschen der Bilder
        setShowExitConfirm(true);
    };

    const confirmExit = async () => {
        if (!activeSlot) return;
        try {
            // Bilder löschen, aber Slot gesperrt lassen
            await clearSlotImagesOnly(activeSlot);
            setActiveSlot(null);
            setShowExitConfirm(false);
            const data = await getSlots(user.id);
            setSlots(data);
        } catch (err) {
            console.error(err);
            alert("Fehler beim Aufräumen.");
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen text-yellow-500 gap-4">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="font-mono text-sm uppercase tracking-widest">Initialisiere Studio...</p>
        </div>
    );

    if (activeSlot) {
        return (
            <div className="w-full max-w-5xl mx-auto p-4 animate-in fade-in duration-500 relative">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={requestBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        Übersicht
                    </button>
                    <div className="bg-gray-900/80 px-4 py-2 rounded-full border border-gray-800 text-xs font-mono">
                        Slot <span className="text-yellow-500">#{activeSlot.slot_number}</span> • 
                        Versuche <span className={activeSlot.attempts_used >= 3 ? "text-red-500" : "text-yellow-500"}>{activeSlot.attempts_used}/3</span>
                    </div>
                </div>
                
                <EnhancedGenerator 
                    slot={activeSlot} 
                    userId={user.id} 
                    onUpdate={(url, prompt, history, promptHistory) => {
                        const newAttempts = activeSlot.attempts_used + 1;
                        // State Update
                        setActiveSlot({
                            ...activeSlot,
                            last_image_base64: url,
                            attempts_used: newAttempts,
                            history_urls: history,
                            prompt_history: promptHistory,
                            is_locked: newAttempts >= 3
                        });
                        // DB Update
                        updateSlotWithUrl(activeSlot.id, url, prompt, newAttempts, history, promptHistory);
                    }}
                />

                {showExitConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-gray-900 border border-red-500/30 p-8 rounded-3xl max-w-md text-center space-y-6 shadow-2xl">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Mappe abschließen?</h3>
                            <p className="text-gray-400">
                                Du hast alle 3 Versuche verbraucht. Wenn du jetzt gehst, wird die Mappe 
                                <span className="text-red-500 font-bold mx-1">gesperrt</span> und die Bilder 
                                <span className="text-red-500 font-bold mx-1">gelöscht</span>.
                                <br/><br/>
                                Hast du deine Ergebnisse gespeichert?
                            </p>
                            <div className="flex flex-col gap-3 pt-2">
                                <button onClick={confirmExit} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all">Ja, abschließen</button>
                                <button onClick={() => setShowExitConfirm(false)} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-all">Abbrechen</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-6 space-y-8">
            <header className="flex justify-between items-center bg-gray-900/40 p-6 rounded-3xl border border-gray-800 backdrop-blur-md">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">Design Studio</h1>
                    <p className="text-gray-500 text-sm">Wähle eine Mappe für deine Entwürfe.</p>
                </div>
                <button onClick={onLogout} className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all text-gray-500">
                    <LogOut className="w-6 h-6" />
                </button>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {slots.map((slot) => {
                    const isLocked = slot.is_locked || slot.attempts_used >= 3;
                    return (
                        <button
                            key={slot.id}
                            onClick={() => setActiveSlot(slot)}
                            disabled={isLocked && !slot.history_urls?.length} // Wenn locked und leer (nach cleanup) -> Nicht klickbar
                            className={`
                                relative group aspect-square rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-3 overflow-hidden
                                ${isLocked
                                    ? 'border-red-900/50 bg-red-950/20 cursor-not-allowed opacity-75'
                                    : slot.attempts_used > 0
                                        ? 'border-yellow-500/30 bg-yellow-900/10' 
                                        : 'border-gray-800 bg-gray-900/20 hover:bg-gray-900 hover:border-gray-600'
                                }
                            `}
                        >
                            <div className={`z-10 p-3 rounded-full backdrop-blur-md border border-white/5 transition-transform ${!isLocked && 'group-hover:scale-110'}`}>
                                {isLocked ? (
                                    <Lock className="w-8 h-8 text-red-500" />
                                ) : (
                                    <Folder className={`w-8 h-8 ${slot.attempts_used > 0 ? 'text-yellow-500' : 'text-gray-600 group-hover:text-gray-300'}`} />
                                )}
                            </div>
                            
                            <div className="z-10 flex flex-col items-center">
                                <span className={`font-bold text-lg ${isLocked ? 'text-red-500' : 'text-white'}`}>Mappe {slot.slot_number}</span>
                                {isLocked ? (
                                    <span className="text-[10px] uppercase tracking-widest text-red-500 font-bold mt-1">Geschlossen</span>
                                ) : slot.attempts_used > 0 && (
                                    <span className="text-[10px] uppercase tracking-widest text-yellow-500 animate-pulse mt-1">In Bearbeitung</span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// --- GENERATOR ---

function EnhancedGenerator({ slot, userId, onUpdate }: { slot: ImageSlot, userId: string, onUpdate: (url: string, prompt: string, history: string[], promptHistory: string[]) => void }) {
    const [prompt, setPrompt] = useState('');
    // Initialisiere History korrekt aus Props
    const [history, setHistory] = useState<string[]>(slot.history_urls || []);
    const [promptHistory, setPromptHistory] = useState<string[]>(slot.prompt_history || []);
    
    const [loading, setLoading] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isProcessingRef, setIsProcessingRef] = useState(false);
    
    const [zoomImage, setZoomImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const forceDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("Download failed", e);
            window.open(url, '_blank');
        }
    };

    const handleSetReference = async (urlOrBase64: string) => {
        setIsProcessingRef(true);
        try {
            if (urlOrBase64.startsWith('http')) {
                const base64 = await urlToBase64(urlOrBase64);
                setReferenceImage(base64);
            } else {
                setReferenceImage(urlOrBase64);
            }
        } catch (e) {
            console.error(e);
            setError("Konnte Referenzbild nicht laden.");
        } finally {
            setIsProcessingRef(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || slot.attempts_used >= 3) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt, 
                    modelType: 'pro', 
                    aspectRatio,
                    referenceImage 
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const webpBlob = await compressImage(data.image, 0.8);
            const publicUrl = await uploadImage(userId, slot.slot_number, webpBlob);

            const newHistory = [...history, publicUrl];
            const newPromptHistory = [...promptHistory, prompt];
            
            setHistory(newHistory);
            setPromptHistory(newPromptHistory);
            
            // Callback mit allen Daten
            onUpdate(publicUrl, prompt, newHistory, newPromptHistory);
            
            setReferenceImage(null);
            setPrompt('');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await fileToBase64(file);
            handleSetReference(base64);
        }
    };

    const [arW, arH] = aspectRatio.split(':').map(Number);
    const arStyle = { aspectRatio: `${arW}/${arH}` };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4 h-56"> {/* Höhe angepasst für größere Boxen */}
                {[0, 1, 2].map((idx) => {
                    const imgUrl = history[idx];
                    return (
                        <div key={idx} className="relative group rounded-xl overflow-hidden bg-gray-950 border border-gray-800 transition-all hover:border-gray-600">
                            {imgUrl ? (
                                <>
                                    <div className="relative w-full h-full">
                                        <Image src={imgUrl} alt="" fill className="object-contain" unoptimized />
                                    </div>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 backdrop-blur-sm z-10">
                                        <div className="flex gap-2">
                                            <button onClick={() => setZoomImage(imgUrl)} className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg" title="Vergrößern">
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleSetReference(imgUrl)} className="p-2 bg-yellow-500 text-black rounded-full hover:scale-110 transition-transform shadow-lg" title="Als Referenz nutzen">
                                                <RefreshCw className="w-5 h-5" />
                                            </button>
                                        </div>
                                        {/* Download Button vergrößert & prominent */}
                                        <button 
                                            onClick={() => forceDownload(imgUrl, `entwurf-${idx+1}.webp`)} 
                                            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-colors mt-2"
                                        >
                                            <Download className="w-3 h-3" />
                                            Speichern
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                                        <span className="font-mono font-bold text-lg">{idx + 1}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-xl border border-gray-800 text-yellow-500 font-bold text-xs uppercase tracking-wider">
                        <Crown className="w-4 h-4" />
                        Nano Banana Pro
                    </div>

                    <div className="flex items-center gap-3 bg-gray-900 p-1.5 rounded-xl border border-gray-800 pl-4">
                        <div className="w-6 flex items-center justify-center">
                            <div className="border-2 border-gray-500 bg-gray-700 w-full rounded-sm transition-all duration-300" style={arStyle}></div>
                        </div>
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        <select 
                            value={aspectRatio} 
                            onChange={e => setAspectRatio(e.target.value)}
                            className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer hover:text-yellow-500 transition-colors"
                        >
                            {['1:1', '16:9', '4:3', '9:16', '3:4'].map(ar => <option key={ar} value={ar} className="bg-gray-900">{ar}</option>)}
                        </select>
                    </div>
                </div>

                {(referenceImage || isProcessingRef) && (
                    <div className="relative inline-block animate-in zoom-in-95 group">
                        <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-yellow-500 shadow-xl shadow-yellow-500/20 bg-gray-900 flex items-center justify-center">
                            {isProcessingRef ? (
                                <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                            ) : (
                                referenceImage && <Image src={referenceImage} alt="Reference" fill className="object-cover" unoptimized />
                            )}
                        </div>
                        <button onClick={() => setReferenceImage(null)} className="absolute -top-2 -right-2 bg-red-500 p-1.5 rounded-full text-white shadow-lg hover:bg-red-600 transition-colors">
                            <X className="w-3 h-3" />
                        </button>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[9px] font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap shadow-lg">Referenz</div>
                    </div>
                )}

                <div className="relative group">
                    {slot.attempts_used >= 3 ? (
                        <div className="w-full bg-red-950/20 border border-red-900/50 text-red-500 rounded-2xl p-8 text-center font-bold animate-pulse">
                            <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            Alle 3 Entwürfe erstellt.
                        </div>
                    ) : (
                        <>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="Beschreibe dein Bild..."
                                className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-6 py-6 pr-32 min-h-[140px] focus:ring-2 focus:ring-yellow-500 outline-none transition-all resize-none shadow-inner"
                            />
                            <div className="absolute right-3 bottom-3 flex gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors" title="Referenzbild hochladen">
                                    <Upload className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleGenerate}
                                    disabled={loading || !prompt.trim()}
                                    className="p-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-yellow-500/20 flex items-center gap-2 font-bold px-4"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Generieren</>}
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
                        </>
                    )}
                </div>
                {error && <p className="text-red-400 text-xs text-center border border-red-900/50 p-2 rounded-lg bg-red-950/30">{error}</p>}
            </div>

            {zoomImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-12 animate-in fade-in backdrop-blur-md" onClick={() => setZoomImage(null)}>
                    <div className="relative w-full h-full flex flex-col items-center justify-center gap-6" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setZoomImage(null)} className="absolute top-4 right-4 p-4 text-white hover:text-yellow-500 transition-colors z-50">
                            <X className="w-10 h-10" />
                        </button>
                        <div className="relative flex-grow w-full max-w-5xl h-[80vh]">
                            <Image src={zoomImage} alt="Zoom" fill className="object-contain" unoptimized />
                        </div>
                        <button 
                            onClick={() => forceDownload(zoomImage, `entwurf-zoom.webp`)}
                            className="flex items-center gap-3 bg-yellow-500 text-black px-8 py-4 rounded-2xl font-bold hover:bg-yellow-400 shadow-xl hover:scale-105 transition-all text-lg"
                        >
                            <Download className="w-6 h-6" />
                            Downloaden
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
