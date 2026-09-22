"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authService } from "@/services/auth/auth.service";
import { getDashboardForRole } from "@/config/dashboard.config";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  function finishLogin(response: any) {
    authService.saveSession(response);
    const role = response.roles?.[0] ?? response.user?.roles?.[0] ?? response.user?.role;
    const dashboard = getDashboardForRole(role);
    if (!dashboard) throw new Error("Your account does not have a supported system role. Contact the administrator.");
    toast.success("Logged in successfully");
    router.replace(dashboard.route);
  }

  async function submitQr(token = qrToken) {
    const value = token.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      const response = await authService.qrLogin(value);
      finishLogin(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "QR card login failed", { id: "qr-login-error" });
    } finally { setLoading(false); }
  }

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera access is not available in this browser. Use the secure card code instead.");
      return;
    }

    try {
      stopScanner();
      setScanning(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const video = videoRef.current;
      if (!video) throw new Error("Scanner video is not ready.");

      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
      const controls = await reader.decodeFromVideoDevice(undefined, video, async (result) => {
        const value = result?.getText()?.trim();
        if (!value || loading) return;
        scannerControlsRef.current?.stop();
        scannerControlsRef.current = null;
        setScanning(false);
        setQrToken(value);
        await submitQr(value);
      });
      scannerControlsRef.current = controls;
    } catch (error) {
      stopScanner();
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError") toast.error("Camera permission was denied. Allow camera access and try again.");
      else if (name === "NotFoundError") toast.error("No camera was found on this device.");
      else toast.error("Could not start the QR scanner. Use the secure card code instead.");
    }
  }

  useEffect(() => () => stopScanner(), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const response = await authService.login({ login, password });
      finishLogin(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast.error(message, { id: "login-error", duration: 5000 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#041a38] text-white">
      {/* Desktop/tablet reference layout: preserve the existing exact design. */}
      <div className="absolute inset-0 hidden md:block">
        <img
          src="/images/login-exact-reference.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
          draggable={false}
        />

        <form onSubmit={onSubmit} className="absolute inset-0 z-10" noValidate>
          <label htmlFor="login-desktop" className="sr-only">Username</label>
          <input
            id="login-desktop" name="login" type="text" value={login}
            onChange={(event) => setLogin(event.target.value)} required autoComplete="username"
            disabled={loading} aria-label="Username" placeholder=" "
            className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
            style={{ left: "37.20%", top: "52.99%", width: "25.55%", height: "6.61%" }}
          />

          <label htmlFor="password-desktop" className="sr-only">Password</label>
          <input
            id="password-desktop" name="password" type="password" value={password}
            onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password"
            disabled={loading} aria-label="Password" placeholder=" "
            className="absolute rounded-[13px] border-0 bg-transparent pl-[3.25%] pr-[1.1%] text-[clamp(12px,0.82vw,15px)] text-white caret-[#f4be4b] outline-none transition-colors focus:bg-[#071f42]/95 disabled:cursor-not-allowed disabled:opacity-70 [&:not(:placeholder-shown)]:bg-[#071f42]/95"
            style={{ left: "37.20%", top: "61.08%", width: "25.55%", height: "6.61%" }}
          />

          <button type="submit" disabled={loading} aria-label={loading ? "Signing in" : "Login"}
            className="absolute cursor-pointer rounded-full bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-[#ffd166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#061a38] disabled:cursor-wait"
            style={{ left: "37.20%", top: "69.97%", width: "25.55%", height: "7.10%" }}>
            <span className="sr-only">{loading ? "Signing in…" : "Login"}</span>
          </button>
          <a href="/forgot-password" aria-label="Forgot Password?" className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]" style={{ left: "40.32%", top: "79.63%", width: "7.15%", height: "3.55%" }}><span className="sr-only">Forgot Password?</span></a>
          <a href="/register" aria-label="Create customer account" className="absolute rounded outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166]" style={{ left: "49.90%", top: "79.63%", width: "11.55%", height: "3.55%" }}><span className="sr-only">Create customer account</span></a>
          <div className="absolute flex items-center justify-center gap-3" style={{ left: "37.20%", top: "85%", width: "25.55%" }}>
            <button type="button" onClick={() => setQrOpen(true)} className="h-10 flex-1 rounded-lg border border-[#f4be4b]/60 bg-[#071f42]/90 px-3 text-sm font-semibold text-[#f4be4b] shadow-lg transition hover:bg-[#0a2850]">QR Card Login</button>
            <button type="button" onClick={() => router.push("/kiosk")} className="h-10 flex-1 rounded-lg bg-[#f4be4b] px-3 text-sm font-bold text-[#041a38] shadow-lg transition hover:bg-[#ffd166] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Kiosk Ordering</button>
          </div>
        </form>
      </div>

      {/* Mobile layout: native responsive controls instead of scaling the desktop screenshot. */}
      <div className="relative z-20 flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 md:hidden">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#f4be4b]/35 bg-[#0a2850] shadow-lg shadow-black/20">
              <span className="text-2xl font-extrabold text-[#f4be4b]">CP</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Cafe POS</h1>
            <p className="mt-2 text-sm text-slate-300">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="rounded-[28px] border border-white/10 bg-[#071f42]/95 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
            <div className="space-y-5">
              <div>
                <label htmlFor="login-mobile" className="mb-2 block text-sm font-semibold text-slate-100">Username</label>
                <input id="login-mobile" name="login" type="text" value={login} onChange={(event) => setLogin(event.target.value)} required autoComplete="username" disabled={loading}
                  placeholder="Enter username"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#041a38] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#f4be4b] focus:ring-2 focus:ring-[#f4be4b]/20 disabled:opacity-70" />
              </div>
              <div>
                <label htmlFor="password-mobile" className="mb-2 block text-sm font-semibold text-slate-100">Password</label>
                <input id="password-mobile" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={loading}
                  placeholder="Enter password"
                  className="h-12 w-full rounded-xl border border-white/15 bg-[#041a38] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-[#f4be4b] focus:ring-2 focus:ring-[#f4be4b]/20 disabled:opacity-70" />
              </div>
              <button type="submit" disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#f4be4b] px-4 text-base font-bold text-[#041a38] shadow-lg shadow-[#f4be4b]/10 transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
                {loading ? "Signing in…" : "Login"}
              </button>
              <button type="button" onClick={() => setQrOpen(true)} className="flex h-12 w-full items-center justify-center rounded-xl border border-[#f4be4b]/60 bg-transparent px-4 text-base font-bold text-[#f4be4b]">Scan QR Card</button>
              <button type="button" onClick={() => router.push("/kiosk")} className="flex h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-base font-bold text-[#041a38] shadow-lg transition active:scale-[0.99]">Kiosk Ordering</button>
            </div>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 text-sm min-[390px]:flex-row min-[390px]:gap-5">
              <a href="/forgot-password" className="font-medium text-[#f4be4b] hover:underline">Forgot Password?</a>
              <span className="hidden text-white/20 min-[390px]:inline">•</span>
              <a href="/register" className="font-medium text-slate-200 hover:text-[#f4be4b]">Create customer account</a>
            </div>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">AIG Cafeteria Management System</p>
        </div>
      </div>

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { stopScanner(); setQrOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#071f42] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">QR Card Login</h2><p className="mt-1 text-sm text-slate-300">Scan the QR card with the camera or enter the secure card code printed below the QR. User ID alone cannot be used to log in.</p></div><button type="button" className="text-2xl text-slate-300" onClick={() => { stopScanner(); setQrOpen(false); }}>×</button></div>
            {scanning && <video ref={videoRef} playsInline muted className="mb-4 aspect-video w-full rounded-xl bg-black object-cover" />}
            <div className="space-y-3">
              <button type="button" onClick={scanning ? stopScanner : startScanner} className="h-11 w-full rounded-xl bg-[#f4be4b] font-bold text-[#041a38]">{scanning ? "Stop Camera" : "Scan with Camera"}</button>
              <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-white/10"/>OR<span className="h-px flex-1 bg-white/10"/></div>
              <input value={qrToken} onChange={(e) => setQrToken(e.target.value)} placeholder="Enter secure QR card code (not User ID)" className="h-11 w-full rounded-xl border border-white/15 bg-[#041a38] px-3 text-white outline-none focus:border-[#f4be4b]" />
              <button type="button" disabled={!qrToken.trim() || loading} onClick={() => submitQr()} className="h-11 w-full rounded-xl border border-white/15 font-semibold disabled:opacity-50">{loading ? "Signing in…" : "Login with QR Card"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
