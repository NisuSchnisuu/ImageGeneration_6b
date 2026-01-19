'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScanSuccess, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Bei Erfolg Scanner stoppen und Text zurückgeben
        if (scannerRef.current) {
            scannerRef.current.clear();
        }
        onScanSuccess(decodedText);
      },
      (error) => {
        // Wir ignorieren normale Scan-Fehler (wenn kein QR gefunden wurde)
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="font-bold">QR-Code scannen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">Schließen</button>
        </div>
        <div id="qr-reader" className="w-full"></div>
        <div className="p-4 text-center text-xs text-gray-500">
          Halte den QR-Code deines Lehrers vor die Kamera.
        </div>
      </div>
    </div>
  );
}
