export function GainsLossCard() {
  return (
    <section className="rounded-2xl border border-white/5 bg-secondary-900/80 p-4 shadow-xl backdrop-blur">
      <p className="text-sm text-gray-400">Total Gains / Losses</p>
      <p className="mt-2 text-3xl font-semibold text-white">+$14,860</p>
      <p className="mt-1 text-sm text-green-400">+3.9% this month</p>

      <div className="mt-5 rounded-xl bg-secondary-800/80 p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
          <span>Risk level</span>
          <span>Moderate</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary-700">
          <div className="h-full w-2/3 rounded-full bg-primary-500" />
        </div>
      </div>
    </section>
  );
}
