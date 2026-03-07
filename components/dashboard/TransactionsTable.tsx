import { transactions, type Transaction } from '@/data/dashboard/roobinMood';

function statusClasses(status: Transaction['status']) {
  if (status === 'Completed') return 'bg-green-500/15 text-green-400';
  if (status === 'Pending') return 'bg-amber-500/15 text-amber-300';
  return 'bg-red-500/15 text-red-400';
}

export function TransactionsTable() {
  return (
    <section className="rounded-2xl border border-white/5 bg-secondary-900/80 p-4 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Past Transactions</h2>
        <button className="text-sm text-primary-400 hover:text-primary-300">View all</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-gray-400">
              <th className="pb-3 pr-4 font-medium">Date</th>
              <th className="pb-3 pr-4 font-medium">Asset</th>
              <th className="pb-3 pr-4 font-medium">Type</th>
              <th className="pb-3 pr-4 font-medium text-right">Amount</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-white/5 text-gray-200 transition hover:bg-white/5">
                <td className="py-3 pr-4">{tx.date}</td>
                <td className="py-3 pr-4">{tx.asset}</td>
                <td className="py-3 pr-4">{tx.type}</td>
                <td className="py-3 pr-4 text-right font-medium">{tx.amount}</td>
                <td className="py-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
