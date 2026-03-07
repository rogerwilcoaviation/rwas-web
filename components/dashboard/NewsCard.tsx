import { latestNews } from '@/data/dashboard/roobinMood';

export function NewsCard() {
  return (
    <section className="rounded-2xl border border-white/5 bg-secondary-900/80 p-4 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Latest News</h2>
        <button className="text-sm text-primary-400 hover:text-primary-300">View more</button>
      </div>

      <ul className="space-y-4">
        {latestNews.map((item) => (
          <li key={item.headline} className="rounded-xl bg-secondary-800/70 p-3">
            <p className="text-sm text-white">{item.headline}</p>
            <p className="mt-1 text-xs text-gray-400">{item.time}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
