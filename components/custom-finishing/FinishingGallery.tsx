export default function FinishingGallery() {
  return (
    <section className="finishing-gallery" aria-labelledby="gallery-title">
      <div className="finishing-section-heading">
        <div>
          <span className="bs-kicker">From the shop</span>
          <h2 id="gallery-title" className="bs-headline bs-headline--section">
            Project Photos
          </h2>
        </div>
        <p className="finishing-intro">Project photos coming soon.</p>
      </div>
      <div className="finishing-gallery-grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="finishing-placeholder-card" key={index}>
            <div className="finishing-placeholder" />
          </div>
        ))}
      </div>
    </section>
  );
}
