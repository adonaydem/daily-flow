import { useCallback, useRef, useState } from 'react';
import { transcribeAudio } from '@/lib/ai';

interface UseWhisperOptions {
  autoStopMs?: number; // auto stop after duration
  language?: string;
}

interface WhisperResult {
  transcript: string;
  appending: boolean;
  error?: string;
}

export function useWhisper(options: UseWhisperOptions = {}) {
  const { autoStopMs = 90_000, language = 'en' } = options;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<WhisperResult>({ transcript: '', appending: false });
  const [uploading, setUploading] = useState(false);

  const start = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
  try {
    setUploading(true);
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

    // Call edge function helper (client never touches OpenAI key)
    const text = await transcribeAudio(blob, language);

    setResult(prev => ({
      transcript: prev.transcript ? prev.transcript + '\n' + text : text,
      appending: false,
    }));
  } catch (e) {
    setResult(prev => ({ ...prev, error: e instanceof Error ? e.message : 'Unknown error', appending: false }));
  } finally {
    setUploading(false);
  }
};
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setResult(r => ({ ...r, appending: true }));
      if (autoStopMs) {
        stopTimerRef.current = window.setTimeout(() => stop(), autoStopMs);
      }
    } catch (e) {
      setResult(prev => ({ ...prev, error: e instanceof Error ? e.message : 'Mic access denied', appending: false }));
    }
  }, [autoStopMs, language, recording]);

  const stop = useCallback(() => {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    setRecording(false);
  }, [recording]);

  const reset = useCallback(() => {
    setResult({ transcript: '', appending: false });
  }, []);

  return { start, stop, reset, recording, uploading, result };
}
