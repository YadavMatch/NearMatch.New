import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Pause, Play, ShieldAlert } from 'lucide-react';
import { decryptVoiceBytes, formatVoiceDuration } from '../lib/voiceCrypto';
import type { ChatMessage } from '../types/models';

interface VoiceNoteBubbleProps {
  message: ChatMessage;
  conversationId: string;
  isMine: boolean;
}

const WAVEFORM_BARS = [38, 62, 48, 84, 70, 95, 56, 78, 64, 90, 52, 74, 44, 60] as const;

export function VoiceNoteBubble({ message, conversationId, isMine }: VoiceNoteBubbleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = useMemo(
    () => Math.max(1, message.voiceDurationSec ?? 1),
    [message.voiceDurationSec]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [message.id]);

  const ensureDecryptedUrl = async (): Promise<string | null> => {
    if (objectUrlRef.current) return objectUrlRef.current;
    if (!message.voiceCiphertext || !message.voiceIv) {
      setDecryptError('Encrypted voice payload unavailable.');
      return null;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const plainBytes = await decryptVoiceBytes({
        ciphertextBase64: message.voiceCiphertext,
        ivBase64: message.voiceIv,
        conversationId,
        senderUid: message.senderId,
        recipientUid: message.recipientId,
        clientId: message.clientId,
      });
      const blob = new Blob([new Uint8Array(plainBytes)], {
        type: message.voiceMimeType || 'audio/webm',
      });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      return url;
    } catch {
      setDecryptError('Unable to decrypt voice note in this session.');
      return null;
    } finally {
      setDecrypting(false);
    }
  };

  const handleTogglePlay = async () => {
    if (decrypting) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    const url = await ensureDecryptedUrl();
    if (!url) return;

    if (audio.src !== url) {
      audio.src = url;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setDecryptError('Audio playback could not start in this browser.');
      setPlaying(false);
    }
  };

  const progressRatio = Math.min(1, Math.max(0, currentTime / totalDuration));
  const activeBarCount = Math.round(progressRatio * WAVEFORM_BARS.length);

  return (
    <div className="space-y-1.5 min-w-[215px] sm:min-w-[245px]">
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void handleTogglePlay()}
          disabled={decrypting}
          aria-label={playing ? 'Pause encrypted voice note' : 'Play encrypted voice note'}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer disabled:opacity-60 ${
            isMine
              ? 'bg-white text-[#C44C29] hover:bg-[#FFF8EC]'
              : 'bg-[#E8603A] text-white hover:bg-[#C44C29]'
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1 h-7" aria-hidden="true">
            {WAVEFORM_BARS.map((heightPct, idx) => {
              const filled = idx < activeBarCount;
              return (
                <span
                  key={idx}
                  style={{ height: `${heightPct}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    isMine
                      ? filled
                        ? 'bg-white'
                        : 'bg-white/40'
                      : filled
                      ? 'bg-[#E8603A]'
                      : 'bg-[#F5C4A8]'
                  }`}
                />
              );
            })}
          </div>

          <div
            className={`flex items-center justify-between gap-2 text-[10px] font-mono ${
              isMine ? 'text-white/90' : 'text-[#7A5234]'
            }`}
          >
            <span className="tabular-nums">
              {decrypting
                ? 'Decrypting...'
                : playing || currentTime > 0
                ? `${formatVoiceDuration(currentTime)} / ${formatVoiceDuration(totalDuration)}`
                : formatVoiceDuration(totalDuration)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              <span>AES-256</span>
            </span>
          </div>
        </div>
      </div>

      {decryptError ? (
        <p
          className={`text-[11px] flex items-center gap-1 ${
            isMine ? 'text-[#FFF8EC]' : 'text-[#C0392B]'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>{decryptError}</span>
        </p>
      ) : null}
    </div>
  );
}
