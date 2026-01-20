'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Loader2, AlertTriangle } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScanSuccess, onClose }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Kleiner Timeout um sicherzustellen, dass das DOM Element da ist
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
              /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          scanner.clear();
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // ignore parse errors
        }
      );

      // Cleanup function
      return () => {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5-qrcode scanner. ", error);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="font-bold">QR-Code scannen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">Schließen</button>
        </div>

        <div className="p-4 bg-black min-h-[300px] flex flex-col justify-center">
          <div id="qr-reader" className="w-full"></div>
          {error && (
            <div className="text-red-400 text-sm text-center mt-4">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
              {error}
            </div>
          )}
        </div>

        <div className="p-4 text-center text-xs text-gray-500 bg-gray-900">
          Halte den QR-Code deines Lehrers vor die Kamera.
          <br />
          Stelle sicher, dass du Kamerazugriff erlaubt hast.
        </div>
      </div>
    </div>
  );
}
