import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal fallback type declarations (avoid needing @types/dom in non-browser builds)
// These are narrowed to just what we use.
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; length: number; isFinal?: boolean }>;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: any) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
}

interface UseSpeechToTextOptions {
  lang?: string;
  interim?: boolean;
  continuous?: boolean;
}

export function useSpeechToText({ lang = 'en-US', interim = true, continuous = false }: UseSpeechToTextOptions = {}) {
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(''); // accumulated final text
  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    const SpeechRecognitionImpl: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;
  const rec: ISpeechRecognition = new SpeechRecognitionImpl();
    rec.lang = lang;
    rec.interimResults = interim;
    rec.continuous = continuous;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => setError(e.error || 'speech-error');
    rec.onresult = (e: ISpeechRecognitionEvent) => {
      let interimChunk = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res: any = e.results[i];
        const text = res[0].transcript;
        if (res.isFinal) {
          newFinal += text + ' ';
        } else {
          interimChunk += text + ' ';
        }
      }
      if (newFinal) {
        setTranscript(prev => (prev ? prev + ' ' : '') + newFinal.trim());
        setInterimTranscript('');
      } else if (interimChunk) {
        setInterimTranscript(interimChunk.trim());
      }
    };

    recognitionRef.current = rec;
    setSupported(true);
  }, [lang, interim, continuous]);

  const start = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) return;
    try { recognitionRef.current.start(); } catch { /* already started */ }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => { setTranscript(''); setInterimTranscript(''); }, []);
  return { supported, listening, transcript, interimTranscript, error, start, stop, reset };
}
