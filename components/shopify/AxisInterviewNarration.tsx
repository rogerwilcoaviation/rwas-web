'use client';

import { useEffect, useRef, useState } from 'react';

type AudioStatus = 'idle' | 'playing' | 'paused' | 'blocked' | 'unavailable';

/**
 * Per-slide narration: the transcript is always rendered as text. The audio
 * element only exists after the visitor opts in, and playback is only started
 * from that opt-in or from a visitor-initiated slide change — never on load.
 */
export default function AxisInterviewNarration({
  enabled,
  src,
  transcript,
}: {
  enabled: boolean;
  src: string;
  transcript: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<AudioStatus>('idle');

  useEffect(() => {
    const audio = audioRef.current;
    if (!enabled || !audio) {
      return;
    }
    audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setStatus('blocked');
      }
    });
  }, [enabled]);

  if (!transcript) {
    return null;
  }

  return (
    <div className="border-b-2 border-black bg-[#f2ecde] px-5 py-4 print:hidden">
      <p className="text-xs font-black uppercase tracking-wide text-neutral-700">
        Captain Jerry&rsquo;s narration (text)
      </p>
      <p className="mt-2 max-w-4xl text-base leading-6 text-neutral-900">
        {transcript}
      </p>
      {enabled ? (
        <div className="mt-3">
          <audio
            ref={audioRef}
            src={src}
            controls
            preload="none"
            className="w-full max-w-xl"
            aria-label="Narration audio for this slide"
            onPlay={() => setStatus('playing')}
            onPause={() => setStatus('paused')}
            onError={() => setStatus('unavailable')}
          />
          <p className="mt-2 text-sm text-neutral-700" role="status">
            {status === 'unavailable'
              ? 'No narration recording is available for this slide yet. The narration text above covers everything it would say.'
              : status === 'blocked'
                ? 'Your browser blocked automatic playback. Use the play button on the audio control to listen.'
                : status === 'playing'
                  ? 'Narration playing. Use the Mute narration button at the top to turn it off.'
                  : ''}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-700">
          Narration audio is off. Use the &ldquo;Turn narration on&rdquo;
          button at the top to play this slide&rsquo;s recording when one is
          available.
        </p>
      )}
    </div>
  );
}
