import { useEffect, useRef } from "react";
import { createSilentWavObjectUrl } from "../utils/silentWavBlob";

/**
 * Persistent silent audio anchor that keeps the WKWebView CoreAudio session
 * active for the whole app lifetime.
 *
 * Root cause it addresses: on macOS 26 WKWebView, activating the audio session
 * is a synchronous WebContent→GPU IPC (RemoteAudioSession::tryToSetActive).
 * Cold inactive→active transitions — which happen every time WaveSurfer starts
 * playback after being idle — can nest that sync wait and freeze WebContent.
 * Holding one always-playing silent element pins the session active, so the
 * app never pays the cold-activation cost again.
 *
 * Renders nothing visible. The <audio> element is silent (zero-PCM WAV) and
 * looping, so it is inaudible yet still counts as producing audio.
 *
 * Spec: docs/execution/specs/wkwebview-audio-session-keepalive-research.md
 */
export function AudioKeepAlive() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const url = createSilentWavObjectUrl();
    el.src = url;
    el.loop = true;
    // Keep it inaudible even though the PCM is already silent (defense-in-depth
    // against any host that treats volume 0 as "not producing audio").
    el.volume = 0.0001;

    let disposed = false;

    const tryPlay = () => {
      if (disposed) return;
      // Autoplay may be blocked until a user gesture; the gesture listeners
      // below cover that case, so swallow the rejection.
      void Promise.resolve(el.play()).catch(() => {});
    };

    // Some engines pause background media on visibility/interruption; resume it.
    const onPause = () => {
      if (!disposed) tryPlay();
    };
    const onGesture = () => tryPlay();

    el.addEventListener("pause", onPause);
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);

    tryPlay();

    return () => {
      disposed = true;
      el.removeEventListener("pause", onPause);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      try {
        el.pause();
      } catch {
        /* element already detached */
      }
      el.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      aria-hidden="true"
      // Not user-controllable; purely a session anchor.
      tabIndex={-1}
      hidden
    />
  );
}
