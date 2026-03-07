'use client';

import { useState } from 'react';
import { Bell, Menu, Search, X } from 'lucide-react';
import { ThemeSwitch } from '@/components/shared/ThemeSwitch';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { kpis } from '@/data/dashboard/roobinMood';
import { BalanceChartCard } from '@/components/dashboard/BalanceChartCard';
import { TransactionsTable } from '@/components/dashboard/TransactionsTable';
import { NewsCard } from '@/components/dashboard/NewsCard';
import { GainsLossCard } from '@/components/dashboard/GainsLossCard';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 transition-colors dark:bg-secondary-950 dark:text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex gap-4 lg:gap-6">
          <div
            className={`fixed inset-y-0 left-0 z-50 p-4 transition-transform duration-300 lg:static lg:z-auto lg:p-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
          >
            <DashboardSidebar />
          </div>

          {sidebarOpen && (
            <button
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            />
          )}

          <main className="min-w-0 flex-1 space-y-4 lg:space-y-6">
            <header className="rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-white/5 dark:bg-secondary-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5 lg:hidden"
                    onClick={() => setSidebarOpen((open) => !open)}
                  >
                    {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                  <div>
                    <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Roobin Mood trading overview</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <label className="relative hidden sm:block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      className="h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-white/10 dark:bg-secondary-800/70 dark:text-gray-100"
                      placeholder="Search"
                    />
                  </label>
                  <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                    <Bell className="h-5 w-5" />
                  </button>
                  <ThemeSwitch />
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {kpis.map((kpi) => (
                <KpiCard key={kpi.label} {...kpi} />
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <BalanceChartCard />
              </div>
              <div className="space-y-4">
                <GainsLossCard />
                <NewsCard />
              </div>
            </section>

            <TransactionsTable />
          </main>
        </div>
      </div>
    </div>
  );
}
