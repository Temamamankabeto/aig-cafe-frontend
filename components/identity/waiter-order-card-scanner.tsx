"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";

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
    reader.decodeFromConstraints({ video: { facingMode: "environment" }, audio: false }, video.current!, (result) => {
      if (result && !accepted.current && !cancelled) {
        accepted.current = true;
        controls.current?.stop();
        setActive(false);
        onScanRef.current(result.getText());
      }
    }).then(c => { if (cancelled) c.stop(); else controls.current = c; })
      .catch(() => { if (!cancelled) { setError("Camera unavailable. Allow camera permission and use HTTPS on the tablet."); setActive(false); } });
    return () => { cancelled = true; controls.current?.stop(); controls.current = null; };
  }, [active]);
  return <div className="space-y-2">
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => { setError(""); setActive(v => !v); }}>
      {active ? "Close camera" : buttonLabel}
    </Button>
    {active && <video ref={video} autoPlay playsInline muted className="h-56 w-full rounded-xl bg-black object-cover" />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
