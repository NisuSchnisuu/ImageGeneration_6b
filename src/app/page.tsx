'use client';

import { useState } from 'react';
import { Send, Image as ImageIcon, Loader2, Download } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setImage(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-black text-white relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800 via-black to-black opacity-50 z-0 pointer-events-none" />

      <div className="z-10 w-full max-w-2xl flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            Nano Banana
          </h1>
          <p className="text-gray-400">Powered by Google Imagen 3</p>
        </div>

        {/* Display Area */}
        <div className="w-full aspect-square bg-gray-900/50 border border-gray-800 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl relative group">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-yellow-400/80">
              <Loader2 className="w-12 h-12 animate-spin" />
              <span className="animate-pulse">Dreaming...</span>
            </div>
          ) : image ? (
            <>
                <Image 
                    src={image} 
                    alt="Generated" 
                    width={1024} 
                    height={1024} 
                    className="w-full h-full object-contain"
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
              <p>Your imagination goes here</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="w-full relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateImage()}
            placeholder="A cyberpunk banana floating in neon space..."
            className="w-full bg-gray-900/80 border border-gray-700 text-white rounded-xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 placeholder-gray-600 transition-all shadow-lg backdrop-blur-sm"
          />
          <button
            onClick={generateImage}
            disabled={loading || !prompt.trim()}
            className="absolute right-2 top-2 bottom-2 bg-yellow-500 hover:bg-yellow-400 text-black p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-xl text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
