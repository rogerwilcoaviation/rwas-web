'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const PANEL_PLANNER_URL = 'https://panelplanner.rwas.team/customer';
const PANEL_PLANNER_POSTER = '/images/social/panel-planner-ad-v5-premium.png';

export function PanelPlannerLaunchFrame() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPlayback = () => {
      if (reducedMotion.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Native controls remain available when autoplay is blocked.
      });
    };

    syncPlayback();
    reducedMotion.addEventListener('change', syncPlayback);

    return () => reducedMotion.removeEventListener('change', syncPlayback);
  }, []);

  return (
    <section
      className="panel-planner-launch"
      aria-labelledby="panel-planner-preview"
    >
      <div className="panel-planner-launch__media">
        {videoError ? (
          <Image
            className="panel-planner-launch__fallback"
            src={PANEL_PLANNER_POSTER}
            alt="Preview of the RWAS Panel Planner showing a Garmin avionics layout in a Cessna R182 panel"
            fill
            sizes="(max-width: 900px) 100vw, 860px"
            priority
          />
        ) : (
          <video
            ref={videoRef}
            className="panel-planner-launch__video"
            aria-label="RWAS Panel Planner promotional video"
            aria-describedby="panel-planner-video-description"
            controls
            muted
            loop
            playsInline
            preload="metadata"
            poster={PANEL_PLANNER_POSTER}
            onError={() => setVideoError(true)}
          >
            <source src="/videos/rwas-panel-planner-promo.webm" type="video/webm" />
            <source src="/videos/rwas-panel-planner-promo.mp4" type="video/mp4" />
            Your browser does not support the Panel Planner promotional video.
          </video>
        )}
      </div>
      <p id="panel-planner-video-description" className="sr-only">
        Promotional video for the RWAS Panel Planner. Use the video controls to
        play or pause the preview.
      </p>
      <div className="panel-planner-launch__caption">
        <div>
          <p className="bs-kicker">Interactive planning tool</p>
          <h2 id="panel-planner-preview">
            Sketch the panel. RWAS engineers the install-ready plan.
          </h2>
        </div>
        <Link
          href={PANEL_PLANNER_URL}
          className="bs-cta-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Panel Planner
        </Link>
      </div>
    </section>
  );
}
