'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type GalleryFilter = 'all' | 'printing' | 'coating';
type PhotoItem = {
  kind: 'photo';
  src: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  categories: Exclude<GalleryFilter, 'all'>[];
};

const VIDEO_SRC =
  '/media/services/custom-printing-finishing/powder-coated-panel-9f07aa85.mp4';

const photos: PhotoItem[] = [
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/piper-panel-45aac9d4.webp',
    width: 1600,
    height: 738,
    caption: 'Printed Piper panel',
    alt: 'Black textured instrument panel with Piper graphic and white control labels',
    categories: ['printing', 'coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/gray-instrument-panel-6d34a1bc.webp',
    width: 1600,
    height: 738,
    caption: 'Gray instrument panel finish',
    alt: 'Wide gray textured instrument panel with circular and rectangular cutouts',
    categories: ['coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/textured-trim-ring-fee4061a.webp',
    width: 738,
    height: 1600,
    caption: 'Textured trim ring',
    alt: 'Hand holding a small black textured square trim ring',
    categories: ['coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/coated-panel-cutouts-41c11395.webp',
    width: 1440,
    height: 1080,
    caption: 'Coated panel cutouts',
    alt: 'Black rectangular panel with multiple instrument cutouts and a fine textured finish',
    categories: ['coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/firewall-fuel-valve-labels-36402f6e.webp',
    width: 1600,
    height: 900,
    caption: 'Firewall and fuel valve labels',
    alt: 'White firewall, fuel valve, and fire extinguisher labels printed on a black textured panel',
    categories: ['printing', 'coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/flap-markings-6acbc6ea.webp',
    width: 1080,
    height: 1440,
    caption: 'Flap and speed markings',
    alt: 'White flap angle and airspeed markings printed beside slots in a dark panel',
    categories: ['printing', 'coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/piper-panel-detail-454e865f.webp',
    width: 738,
    height: 1600,
    caption: 'Piper panel detail',
    alt: 'Piper graphic and white equipment label printed on a gray textured instrument panel',
    categories: ['printing', 'coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/panel-speed-labels-b5c5a5cf.webp',
    width: 738,
    height: 1600,
    caption: 'Speed and microphone labels',
    alt: 'White maneuvering speed, crosswind, microphone, and phone labels on a textured panel',
    categories: ['printing', 'coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/paired-coated-panels-dd686895.webp',
    width: 738,
    height: 1600,
    caption: 'Paired coated panels',
    alt: 'Two black instrument panels with rectangular and circular cutouts resting on a machine bed',
    categories: ['coating'],
  },
  {
    kind: 'photo',
    src: '/media/services/custom-printing-finishing/cardinal-rg-panel-bd723e91.webp',
    width: 738,
    height: 1600,
    caption: 'Cardinal RG panel graphics',
    alt: 'Orange bird and Cardinal RG graphic with white control labels on a black instrument panel',
    categories: ['printing', 'coating'],
  },
];

const filters: { value: GalleryFilter; label: string }[] = [
  { value: 'all', label: 'All projects' },
  { value: 'printing', label: 'Printed graphics' },
  { value: 'coating', label: 'Coated finishes' },
];

export default function FinishingGallery() {
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [activePhoto, setActivePhoto] = useState<PhotoItem | null>(null);
  const [videoStarted, setVideoStarted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastPhotoButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activePhoto && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [activePhoto]);

  const closePhoto = () => {
    dialogRef.current?.close();
    setActivePhoto(null);
    lastPhotoButton.current?.focus();
  };

  const startVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.src = VIDEO_SRC;
    video.load();
    setVideoStarted(true);
    void video.play().catch(() => setVideoStarted(false));
  };

  const changeFilter = (nextFilter: GalleryFilter) => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setVideoStarted(false);
    setFilter(nextFilter);
  };

  const visiblePhotos = photos.filter(
    (photo) => filter === 'all' || photo.categories.includes(filter),
  );
  const showVideo = filter === 'all' || filter === 'coating';

  return (
    <section className="finishing-gallery" aria-labelledby="gallery-title">
      <div className="finishing-section-heading">
        <div>
          <span className="bs-kicker">From the shop</span>
          <h2 id="gallery-title" className="bs-headline bs-headline--section">
            Project Gallery
          </h2>
        </div>
        <p className="finishing-intro">
          Supplied examples of printed graphics and textured finishes.
        </p>
      </div>

      <div className="finishing-filter" aria-label="Filter project gallery">
        {filters.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={filter === option.value}
            onClick={() => changeFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="finishing-gallery-grid">
        {showVideo && (
          <figure className="finishing-media-card finishing-video-card">
            <div className="finishing-video-frame">
              <video
                ref={videoRef}
                controls
                playsInline
                preload="none"
                poster="/media/services/custom-printing-finishing/powder-coated-panel-poster-9f07aa85.webp"
                aria-label="Video showing a textured coated panel"
              >
                Your browser does not support embedded video.
              </video>
              {!videoStarted && (
                <button
                  type="button"
                  className="finishing-video-play"
                  onClick={startVideo}
                  aria-label="Play textured coated panel video"
                >
                  <span aria-hidden="true">▶</span> Play video
                </button>
              )}
            </div>
            <figcaption>Textured coated panel</figcaption>
          </figure>
        )}

        {visiblePhotos.map((photo) => (
          <figure className="finishing-media-card" key={photo.src}>
            <button
              type="button"
              className="finishing-photo-button"
              aria-label={`Open full image: ${photo.caption}`}
              onClick={(event) => {
                lastPhotoButton.current = event.currentTarget;
                setActivePhoto(photo);
              }}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 780px) 100vw, 50vw"
              />
            </button>
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="finishing-gallery-dialog"
        aria-label={activePhoto ? activePhoto.caption : 'Project image'}
        onClose={() => setActivePhoto(null)}
        onCancel={(event) => {
          event.preventDefault();
          closePhoto();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePhoto();
        }}
      >
        {activePhoto && (
          <div className="finishing-dialog-content">
            <button
              type="button"
              className="finishing-dialog-close"
              onClick={closePhoto}
              aria-label="Close full image"
            >
              ×
            </button>
            <Image
              src={activePhoto.src}
              alt={activePhoto.alt}
              width={activePhoto.width}
              height={activePhoto.height}
              sizes="95vw"
            />
            <p>{activePhoto.caption}</p>
          </div>
        )}
      </dialog>
    </section>
  );
}
