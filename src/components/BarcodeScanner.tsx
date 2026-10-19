"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Volume2, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
};

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const onCloseRef = useRef(onClose);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    const cleanup = () => {
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
      const v = videoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {}
        v.srcObject = null;
      }
    };

    const start = async () => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("La cámara requiere conexión HTTPS o localhost.");
        setStarting(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Tu navegador no soporta acceso a la cámara.");
        setStarting(false);
        return;
      }

      let tries = 0;
      while (!videoRef.current && tries < 30) {
        await new Promise((r) => setTimeout(r, 50));
        tries++;
      }
      if (cancelled) return;
      if (!videoRef.current) {
        setError("No se pudo inicializar el visor de la cámara.");
        setStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
        ]);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 80,
          delayBetweenScanSuccess: 1200,
        });

        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              const text = result.getText().trim();
              if (text) {
                // Beep audio
                try {
                  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.type = "sine";
                  osc.frequency.setValueAtTime(1200, ctx.currentTime);
                  gain.gain.setValueAtTime(0.15, ctx.currentTime);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.12);
                } catch {}

                onDetectedRef.current(text);
                onCloseRef.current();
              }
            }
          }
        );

        controlsRef.current = controls;
        setStarting(false);
      } catch (err: any) {
        if (cancelled) return;
        setStarting(false);
        if (err?.name === "NotAllowedError") {
          setError("Permiso denegado para usar la cámara.");
        } else if (err?.name === "NotFoundError") {
          setError("No se detectó ninguna cámara disponible.");
        } else {
          setError(err?.message || "Error al iniciar la cámara.");
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Escanear Código de Barras
          </DialogTitle>
          <DialogDescription className="text-xs">
            Apunta la cámara al código de barras o QR del producto.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-black flex items-center justify-center my-2">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs">Iniciando cámara...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center text-white gap-2">
              <X className="h-8 w-8 text-destructive" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
          )}

          {/* Guía visual de escaneo */}
          {!starting && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-1/2 border-2 border-primary/70 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
          <span>Soporta EAN-13, UPC, Code-128 y QR</span>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-7">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
