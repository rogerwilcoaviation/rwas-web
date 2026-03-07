type KpiCardProps = {
  label: string;
  value: string;
  delta: string;
};

export function KpiCard({ label, value, delta }: KpiCardProps) {
  const positive = delta.startsWith('+');

  return (
    <article className="rounded-2xl border border-white/5 bg-secondary-900/80 p-4 shadow-xl backdrop-blur">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className={`mt-2 text-xs ${positive ? 'text-green-400' : 'text-red-400'}`}>{delta}</p>
    </article>
  );
}
