/**
 * Demo TTS plugin — uses the browser Web Speech API (speechSynthesis)
 * as a minimal TTS provider. No network calls, works offline.
 */

import type { PluginContext, TtsProvider, TtsResult, TtsSynthesizeParams, TtsVoice } from "../../plugin-system";

const DEMO_VOICES: TtsVoice[] = [
  { id: "zh-CN", name: "中文（普通话）", lang: "zh-CN" },
  { id: "en-US", name: "English (US)", lang: "en-US" },
];

export function activate(context: PluginContext): void {
  const provider: TtsProvider = {
    type: "tts.provider",
    id: "demo.browser-tts",
    name: "浏览器语音合成 (Demo)",
    description: "使用系统 speechSynthesis 朗读文本",
    voices(): Promise<TtsVoice[]> {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        return Promise.resolve(DEMO_VOICES);
      }
      const sys = window.speechSynthesis.getVoices();
      if (sys.length === 0) return Promise.resolve(DEMO_VOICES);
      return Promise.resolve(
        sys
          .filter((v) => v.lang.startsWith("zh") || v.lang.startsWith("en"))
          .map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang })),
      );
    },
    async synthesize(params: TtsSynthesizeParams): Promise<TtsResult> {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        throw new Error("当前环境不支持 speechSynthesis");
      }
      return new Promise((resolve, reject) => {
        const utter = new SpeechSynthesisUtterance(params.text);
        const voices = window.speechSynthesis.getVoices();
        if (params.voiceId) {
          const v = voices.find((x) => x.voiceURI === params.voiceId);
          if (v) utter.voice = v;
        }
        if (params.speed) utter.rate = params.speed;
        const t0 = performance.now();
        utter.onend = () => {
          resolve({
            audioBlob: new Blob([], { type: "audio/wav" }),
            durationMs: performance.now() - t0,
          });
        };
        utter.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));
        window.speechSynthesis.speak(utter);
      });
    },
  };

  context.register(provider);
}

export function deactivate(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
