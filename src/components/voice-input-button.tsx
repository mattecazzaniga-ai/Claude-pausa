"use client";

import { useRef, useState } from "react";

// Web Speech API has no official TS lib types; this is the minimal shape we use.
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Master prompt §32 (voice notes): "add a note in under 10 seconds." Uses the
 * browser's native speech recognition — no server round-trip, no new
 * dependency — and hides itself entirely when unsupported (Firefox, Safari
 * on some versions) rather than showing a button that would just fail.
 */
export function VoiceInputButton({ onResult, lang = "it-IT" }: { onResult: (text: string) => void; lang?: string }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = getSpeechRecognitionCtor() !== null;

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Ferma registrazione" : "Registra una nota vocale"}
      className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
        listening ? "border-negative bg-negative/15 text-negative" : "border-border text-muted hover:bg-surface-2"
      }`}
    >
      {listening ? "⏺ In ascolto…" : "🎤 Nota vocale"}
    </button>
  );
}
