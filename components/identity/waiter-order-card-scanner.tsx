"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

type CameraDiagnostic = { name: string; message: string };

function explainCameraError(cause: unknown): CameraDiagnostic {
  const name = cause instanceof Error ? cause.name : "UnknownError";
  const message = cause instanceof Error ? cause.message : String(cause);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return { name, message: "Chrome refused camera access. Check this site's Camera permission and Android Camera access. If there was no permission prompt, check browser restrictions or the website's Permissions-Policy header." };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { name, message: "No usable camera was found." };
  if (name === "NotReadableError" || name === "TrackStartError") return { name, message: "Camera is already in use or could not start. Close other camera apps." };
  if (name === "OverconstrainedError") return { name, message: "The requested camera settings are unsupported." };
  return { name, message: `Camera could not start: ${message}` };
}

export function WaiterOrderCardScanner({ onScan, disabled = false, buttonLabel = "Scan Waiter QR Card with Tablet Camera" }: { onScan: (code: string) => void; disabled?: boolean; buttonLabel?: string }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<CameraDiagnostic | null>(null);
  const [permissionState, setPermissionState] = useState<string>("unknown");
  const [cameraStage, setCameraStage] = useState("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const acceptedRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    acceptedRef.current = false;

    async function start() {
      try {
        setCameraStage("checking");
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API unavailable: a secure HTTPS browser context is required.");
        }
        // A Permissions-Policy restriction can reject getUserMedia before Chrome prompts.
        const policy = document as Document & { permissionsPolicy?: { allowsFeature: (name: string) => boolean }; featurePolicy?: { allowsFeature: (name: string) => boolean } };
        const featurePolicy = policy.permissionsPolicy ?? policy.featurePolicy;
        if (featurePolicy && !featurePolicy.allowsFeature("camera")) {
          throw new Error("Camera blocked by the website Permissions-Policy or embedding frame. Allow camera for this origin.");
        }
        try {
          const status = await navigator.permissions?.query({ name: "camera" as PermissionName });
          if (!cancelled && status) setPermissionState(status.state);
        } catch { /* Not all browsers expose camera permission status. */ }
        if (cancelled) return;
        setCameraStage("requesting");
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        } catch (firstError) {
          // Only retry an unsupported camera constraint, never bypass a permission denial.
          if (firstError instanceof Error && (firstError.name === "OverconstrainedError" || firstError.name === "NotFoundError")) {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } else throw firstError;
        }
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const element = videoRef.current;
        if (!element) throw new Error("Camera preview element unavailable.");
        element.setAttribute("playsinline", "true");
        setCameraStage("scanning");
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 180 });
        const controls = await reader.decodeFromStream(stream, element, result => {
          if (!result || cancelled || acceptedRef.current) return;
          const code = result.getText().trim();
          if (!code) return;
          acceptedRef.current = true;
          stop();
          setActive(false);
          onScanRef.current(code);
        });
        if (cancelled || acceptedRef.current) controls.stop();
        else controlsRef.current = controls;
      } catch (cause) {
        if (cancelled) return;
        console.error("ENTERPOS live waiter-card camera failed", cause);
        setError(explainCameraError(cause));
        setCameraStage("error");
        stop();
        setActive(false);
      }
    }
    void start();
    return () => { cancelled = true; stop(); };
  }, [active, stop]);

  const toggle = () => {
    if (active) { stop(); setActive(false); setCameraStage("idle"); }
    else { setError(null); setPermissionState("unknown"); setActive(true); }
  };

  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={toggle}>
      {active ? "Close camera" : buttonLabel}
    </Button>
    {active && <div className="space-y-2">
      <video ref={videoRef} autoPlay playsInline muted className="h-64 w-full rounded-xl bg-black object-cover" />
      <p className="text-center text-sm">{cameraStage === "scanning" ? "Hold the waiter QR card in front of the camera. Detection is automatic—no photo needed." : "Opening live camera…"}</p>
    </div>}
    {error && <div role="alert" className="space-y-1 text-sm text-red-700">
      <p>{error.message}</p>
      <p className="text-xs">Diagnostic: {error.name} · Camera permission: {permissionState} · Secure context: {typeof window !== "undefined" && window.isSecureContext ? "yes" : "no"}</p>
    </div>}
    {error && <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => { setError(null); setActive(true); }}>Retry live camera</Button>}
  </div>;
}
