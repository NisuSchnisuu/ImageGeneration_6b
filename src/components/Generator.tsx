'use client';

import { useState } from 'react';
import { Send, Image as ImageIcon, Loader2, Download, Zap, Crown, LogOut } from 'lucide-react';
import Image from 'next/image';

interface GeneratorProps {
    user: any; // Das Supabase User Objekt
    onLogout: () => void;
}

export default function Generator({ user, onLogout }: GeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'flash' | 'pro'>('flash');

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setImage(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prompt, 
            modelType 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      if (data.image) {
        setImage(data.image);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="z-10 w-full max-w-2xl flex flex-col items-center gap-6">
        {/* Header mit Logout */}
        <div className="w-full flex justify-between items-center mb-4">
            <div className="flex flex-col">
                <span className="text-xs text-gray-500 uppercase tracking-widest">Angemeldet als</span>
                <span className="text-yellow-500 font-bold">{user.email || user.username || 'Schüler'}</span>
            </div>
            <button 
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Abmelden"
            >
                <LogOut className="w-5 h-5" />
            </button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            Nano Banana
          </h1>
          <p className="text-gray-400 text-sm md:text-base">Dein kreativer KI-Begleiter</p>
        </div>

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

        {/* Display Area */}
        <div className="w-full aspect-square bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl relative group">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-yellow-400/80">
              <Loader2 className="w-12 h-12 animate-spin" />
              <div className="flex flex-col items-center text-center px-4">
                <span className="animate-pulse font-medium text-sm">Ich erstelle dein Bild mit {modelType === 'pro' ? 'Nano Banana Pro' : 'Nano Banana'}...</span>
                <span className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">Bitte habe kurz Geduld</span>
              </div>
            </div>
          ) : image ? (
            <>
                <Image 
                    src={image} 
                    alt="Generated" 
                    width={1024} 
                    height={1024} 
                    className="w-full h-full object-contain"
                    unoptimized 
                />
                <a 
                    href={image} 
                    download={`nano-banana-${Date.now()}.png`}
                    className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-full transition-all opacity-0 group-hover:opacity-100"
                >
                    <Download className="w-6 h-6 text-white" />
                </a>
            </>
          ) : (
            <div className="text-gray-700 flex flex-col items-center gap-2">
              <ImageIcon className="w-16 h-16 opacity-20" />
              <p className="text-sm">Beschreibe dein Bild und klicke auf Senden</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="w-full space-y-4">
            <div className="relative">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generateImage()}
                    placeholder="Ein fliegendes Klassenzimmer im Weltall..."
                    className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 placeholder-gray-600 transition-all shadow-lg backdrop-blur-sm"
                />
                <button
                    onClick={generateImage}
                    disabled={loading || !prompt.trim()}
                    className={`absolute right-2 top-2 bottom-2 p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        modelType === 'pro' ? 'bg-orange-500 hover:bg-orange-400' : 'bg-yellow-500 hover:bg-yellow-400'
                    } text-black`}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-sm text-center">
            {error}
          </div>
        )}
    </div>
  );
}
