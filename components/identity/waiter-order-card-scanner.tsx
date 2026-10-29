"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  const detail = error instanceof Error ? error.message : String(error);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Camera permission denied. Allow Camera for this website in Chrome settings, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No usable camera was found. Check that the tablet camera is available.";
  if (name === "NotReadableError" || name === "TrackStartError") return "The camera is busy or cannot start. Close other camera apps and try again.";
  if (name === "OverconstrainedError") return "The requested camera is unavailable on this tablet. Try again with the default camera.";
  return `Unable to start camera (${name}: ${detail}). Please try again.`;
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
      setError("Camera preview could not be initialized. Please try again.");
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
      // Prefer the back camera, but support tablets that do not expose facingMode.
      try {
        return await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false }, element, handleResult
        );
      } catch (firstError) {
        if (cancelled || (firstError instanceof Error && ["NotAllowedError", "PermissionDeniedError"].includes(firstError.name))) throw firstError;
        return reader.decodeFromConstraints({ video: true, audio: false }, element, handleResult);
      }
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
    {active && <video ref={video} autoPlay playsInline muted className="h-56 w-full rounded-xl bg-black object-cover" />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
