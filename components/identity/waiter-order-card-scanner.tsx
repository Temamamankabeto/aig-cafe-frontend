"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  const detail = error instanceof Error ? error.message : String(error);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return `Chrome denied live camera access (${name}: ${detail}). You can use Take Photo / Choose QR Image below without enabling the live scanner.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No usable camera was found for live scanning. Try Take Photo / Choose QR Image.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Camera is busy or cannot start. Close other camera apps or use Take Photo / Choose QR Image.";
  if (name === "OverconstrainedError") return "The requested camera is unavailable. Try the photo option.";
  return `Unable to start live camera (${name}: ${detail}). Try the photo option.`;
}

export function WaiterOrderCardScanner({ onScan, disabled = false, buttonLabel = "Scan Waiter QR Card with Tablet Camera" }: { onScan: (code: string) => void; disabled?: boolean; buttonLabel?: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [readingPhoto, setReadingPhoto] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const accepted = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    accepted.current = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
    const element = video.current;
    if (!element) {
      setError("Camera preview could not be initialized. Try the photo option.");
      setActive(false);
      return;
    }

    const handleResult = (result: { getText(): string } | undefined | null) => {
      if (!result || cancelled || accepted.current) return;
      accepted.current = true;
      controls.current?.stop();
      setActive(false);
      onScanRef.current(result.getText());
    };

    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API unavailable in this browser or insecure context");
      }
      return reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, element, handleResult);
    };

    void start().then((control) => {
      if (cancelled || accepted.current) control.stop();
      else controls.current = control;
    }).catch((cause: unknown) => {
      if (!cancelled) {
        console.error("ENTERPOS waiter QR camera initialization failed", cause);
        setError(cameraError(cause));
        setActive(false);
      }
    });

    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
      if (element.srcObject instanceof MediaStream) {
        element.srcObject.getTracks().forEach(track => track.stop());
        element.srcObject = null;
      }
    };
  }, [active]);

  const scanPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || disabled || readingPhoto) return;
    setError("");
    setReadingPhoto(true);
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(url);
      controls.current?.stop();
      setActive(false);
      onScanRef.current(result.getText());
    } catch (cause) {
      console.error("ENTERPOS waiter QR photo decoding failed", cause);
      setError("Could not read a QR code from that photo. Ensure the entire card QR code is sharp and well lit, then try again.");
    } finally {
      URL.revokeObjectURL(url);
      setReadingPhoto(false);
    }
  };

  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled || readingPhoto} onClick={() => { setError(""); setActive(v => !v); }}>
      {active ? "Close camera" : buttonLabel}
    </Button>
    {active && <video ref={video} autoPlay playsInline muted className="h-56 w-full rounded-xl bg-black object-cover" />}
    {error && <div role="alert" className="text-sm text-red-700"><p>{error}</p></div>}
    <label className={`flex min-h-10 w-full items-center justify-center rounded-md border px-3 py-2 text-center text-sm font-medium ${disabled || readingPhoto ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      {readingPhoto ? "Reading QR photo..." : "Take Photo / Choose QR Image (camera fallback)"}
      <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled || readingPhoto} onChange={scanPhoto} />
    </label>
    {error && <Button type="button" variant="outline" className="w-full" disabled={disabled || readingPhoto} onClick={() => { setError(""); setActive(true); }}>Retry live camera</Button>}
  </div>;
}
