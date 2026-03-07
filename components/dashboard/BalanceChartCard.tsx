import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { balanceData } from '@/data/dashboard/roobinMood';

export function BalanceChartCard() {
  return (
    <section className="rounded-2xl border border-white/5 bg-secondary-900/80 p-4 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Account Balance</p>
          <p className="text-xl font-semibold text-white">$248,420</p>
        </div>
        <button className="rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-secondary-900 transition hover:bg-primary-400">
          Export
        </button>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={balanceData}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.35} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.45)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.45)" fontSize={12} width={56} />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,24,39,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
              }}
              labelStyle={{ color: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="rgb(34 197 94)"
              fill="url(#balanceGradient)"
              className="text-primary-400"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
