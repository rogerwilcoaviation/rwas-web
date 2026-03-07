import { LayoutDashboard, Newspaper, BarChart3, Wallet, Settings, Search } from 'lucide-react';
import { navItems } from '@/data/dashboard/roobinMood';

const icons = [LayoutDashboard, Wallet, BarChart3, Newspaper, Settings];

export function DashboardSidebar() {
  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-white/5 bg-secondary-900/90 p-4 shadow-2xl backdrop-blur">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 font-display font-semibold text-secondary-900">
          R
        </div>
        <div>
          <p className="font-display text-base font-semibold text-white">Roobin Mood</p>
          <p className="text-xs text-gray-400">Trading Desk</p>
        </div>
      </div>

      <label className="relative mb-6 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          placeholder="Search"
          className="h-10 w-full rounded-xl border border-white/10 bg-secondary-800/80 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </label>

      <nav className="space-y-2">
        {navItems.map((item, index) => {
          const Icon = icons[index] ?? LayoutDashboard;
          return (
            <button
              key={item.label}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition ${
                item.active
                  ? 'bg-primary-500/15 text-white shadow-lg shadow-black/30'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${item.active ? 'text-primary-400' : 'text-gray-500'}`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 rounded-xl border border-primary-500/20 bg-primary-500/10 p-4">
        <p className="text-sm font-medium text-white">Unlock Pro Analytics</p>
        <p className="mt-1 text-xs text-gray-300">Get live signals and advanced market indicators.</p>
        <button className="mt-4 h-9 w-full rounded-full bg-primary-500 text-sm font-medium text-secondary-900 transition hover:bg-primary-400">
          Upgrade
        </button>
      </div>
    </aside>
  );
}
