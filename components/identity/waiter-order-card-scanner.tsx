"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  const detail = error instanceof Error ? error.message : String(error);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return `Chrome denied live camera access (${name}: ${detail}). Allow Camera for this site in Chrome and retry.`;
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No usable camera was found for live scanning. Check Chrome camera permission and retry.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Camera is busy or cannot start. Close other camera apps or use Take Photo / Choose QR Image.";
  if (name === "OverconstrainedError") return "The requested camera is unavailable. Check Chrome camera permission and retry.";
  return `Unable to start live camera (${name}: ${detail}). Check Chrome camera permission and retry.`;
}

export function WaiterOrderCardScanner({ onScan, disabled = false, buttonLabel = "Scan Waiter QR Card with Tablet Camera" }: { onScan: (code: string) => void; disabled?: boolean; buttonLabel?: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
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
      setError("Camera preview could not be initialized. Check Chrome camera permission and retry.");
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

  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => { setError(""); setActive(v => !v); }}>
      {active ? "Close camera" : buttonLabel}
    </Button>
    {active && <div className="space-y-2"><video ref={video} autoPlay playsInline muted className="h-64 w-full rounded-xl bg-black object-cover" /><p className="text-center text-sm">Point the camera at the waiter QR code. Scanning happens automatically—no photo needed.</p></div>}
    {error && <div role="alert" className="text-sm text-red-700"><p>{error}</p></div>}
    {error && <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => { setError(""); setActive(true); }}>Retry live camera</Button>}
  </div>;
}
