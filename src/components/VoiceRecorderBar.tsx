import { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Pause, Play, Send, Square, Trash2, X } from 'lucide-react';
import { VOLUMETRIC_LIMITS } from '../lib/constants';
import { formatVoiceDuration, pickSupportedAudioMimeType } from '../lib/voiceCrypto';

interface VoiceRecorderBarProps {
  conversationId: string;
  disabled?: boolean;
  sending?: boolean;
  onRecordingStateChange?: (active: boolean) => void;
  onError: (message: string | null) => void;
  onSendVoiceNote: (payload: {
    audioBytes: Uint8Array;
    mimeType: string;
    durationSec: number;
  }) => Promise<boolean>;
}

interface RecordedClip {
  blob: Blob;
  previewUrl: string;
  mimeType: string;
  durationSec: number;
}

export function VoiceRecorderBar({
  conversationId,
  disabled = false,
  sending = false,
  onRecordingStateChange,
  onError,
  onSendVoiceNote,
}: VoiceRecorderBarProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startMsRef = useRef<number>(0);
  const discardedRef = useRef(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  };

  const clearRecordedClip = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
    }
    setPreviewPlaying(false);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setRecordedClip(null);
  };

  const cleanupRecording = () => {
    stopTimer();
    discardedRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore already stopped recorder
      }
    }
    mediaRecorderRef.current = null;
    stopStream();
    setRecording(false);
    setElapsedSec(0);
    clearRecordedClip();
    onRecordingStateChange?.(false);
  };

  useEffect(() => {
    cleanupRecording();
    return () => {
      cleanupRecording();
    };
  }, [conversationId]);

  const stopRecordingAndKeep = () => {
    stopTimer();
    discardedRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    if (disabled || sending || recording) return;
    onError(null);
    clearRecordedClip();

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Voice note recording is unavailable in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardedRef.current = false;

      const preferredMime = pickSupportedAudioMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 16_000,
        ...(preferredMime ? { mimeType: preferredMime } : {}),
      };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        stopStream();
        mediaRecorderRef.current = null;
        if (discardedRef.current) {
          onRecordingStateChange?.(false);
          return;
        }

        const rawDuration = (Date.now() - startMsRef.current) / 1000;
        const durationSec = Math.max(
          0.5,
          Math.min(VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC, Math.round(rawDuration * 10) / 10)
        );
        const finalMime = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });

        if (blob.size === 0 || rawDuration < 0.4) {
          onError('Voice note was too short — hold or speak for at least 1 second.');
          onRecordingStateChange?.(false);
          return;
        }

        const previewUrl = URL.createObjectURL(blob);
        previewUrlRef.current = previewUrl;
        setRecordedClip({
          blob,
          previewUrl,
          mimeType: finalMime,
          durationSec,
        });
        onRecordingStateChange?.(true);
      };

      startMsRef.current = Date.now();
      setElapsedSec(0);
      setRecording(true);
      onRecordingStateChange?.(true);
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startMsRef.current) / 1000);
        setElapsedSec(secs);
        if (secs >= VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC) {
          stopRecordingAndKeep();
        }
      }, 200);
    } catch {
      stopStream();
      setRecording(false);
      onRecordingStateChange?.(false);
      onError('Microphone permission was declined or unavailable. Allow mic access to send voice notes.');
    }
  };

  const handleTogglePreview = async () => {
    const audio = previewAudioRef.current;
    if (!audio || !recordedClip) return;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
      return;
    }
    if (audio.src !== recordedClip.previewUrl) {
      audio.src = recordedClip.previewUrl;
    }
    try {
      await audio.play();
      setPreviewPlaying(true);
    } catch {
      setPreviewPlaying(false);
    }
  };

  const handleSendClip = async () => {
    if (!recordedClip || sending) return;
    onError(null);
    try {
      const arrayBuffer = await recordedClip.blob.arrayBuffer();
      const ok = await onSendVoiceNote({
        audioBytes: new Uint8Array(arrayBuffer),
        mimeType: recordedClip.mimeType,
        durationSec: recordedClip.durationSec,
      });
      if (ok) {
        clearRecordedClip();
        onRecordingStateChange?.(false);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to encrypt and send voice note.');
    }
  };

  if (recording) {
    return (
      <div className="flex-1 flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-[#FDE4D8]/60 border border-[#E8603A]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8603A] animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#3D2817]">
              Recording voice note...
            </p>
            <p className="text-[11px] font-mono text-[#7A5234] tabular-nums">
              {formatVoiceDuration(elapsedSec)} / {formatVoiceDuration(VOLUMETRIC_LIMITS.MAX_VOICE_DURATION_SEC)} · AES-256
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={cleanupRecording}
            aria-label="Cancel voice recording"
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FFF8EC] text-xs font-bold text-[#7A5234] inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={stopRecordingAndKeep}
            aria-label="Stop and preview voice note"
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    );
  }

  if (recordedClip) {
    return (
      <div className="flex-1 flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-[#DCF0EA]/65 border border-[#A9D7C8]">
        <audio
          ref={previewAudioRef}
          onEnded={() => setPreviewPlaying(false)}
          onPause={() => setPreviewPlaying(false)}
        />

        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => void handleTogglePreview()}
            aria-label={previewPlaying ? 'Pause recorded voice note' : 'Play recorded voice note'}
            className="w-9 h-9 rounded-full bg-[#3D8C7A] hover:bg-[#2E6B5C] text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#3D2817] flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#2E6B5C] shrink-0" />
              <span>Ready to encrypt &amp; send ({formatVoiceDuration(recordedClip.durationSec)})</span>
            </p>
            <p className="text-[11px] text-[#2E6B5C]">
              Encrypted locally with AES-256 before leaving your device
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={sending}
            onClick={cleanupRecording}
            aria-label="Discard voice note"
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#F5C4A8] bg-white hover:bg-[#FDE4D8]/50 text-xs font-bold text-[#C44C29] inline-flex items-center gap-1 cursor-pointer disabled:opacity-55"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSendClip()}
            aria-label="Send encrypted voice note"
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-55"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Encrypting...' : 'Send Voice'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || sending}
      onClick={() => void startRecording()}
      aria-label="Record encrypted voice note"
      title="Send short encrypted voice note (up to 25s)"
      className="min-h-[44px] px-3 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA]/65 hover:bg-[#DCF0EA] text-xs font-bold text-[#2E6B5C] inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-45"
    >
      <Mic className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline">Voice</span>
    </button>
  );
}
