export type DashboardNavItem = {
  label: string;
  active?: boolean;
};

export type BalancePoint = {
  day: string;
  balance: number;
};

export type Transaction = {
  id: string;
  date: string;
  asset: string;
  type: 'Buy' | 'Sell' | 'Deposit' | 'Withdraw';
  amount: string;
  status: 'Completed' | 'Pending' | 'Failed';
};

export const navItems: DashboardNavItem[] = [
  { label: 'Dashboard', active: true },
  { label: 'Portfolio' },
  { label: 'Transactions' },
  { label: 'Analytics' },
  { label: 'News' },
];

export const kpis = [
  { label: 'Total Balance', value: '$248,420', delta: '+6.2%' },
  { label: 'Total Gains/Losses', value: '+$14,860', delta: '+3.9%' },
  { label: 'Monthly Volume', value: '$86,110', delta: '-1.2%' },
];

export const balanceData: BalancePoint[] = [
  { day: 'Mon', balance: 228000 },
  { day: 'Tue', balance: 231500 },
  { day: 'Wed', balance: 237200 },
  { day: 'Thu', balance: 240400 },
  { day: 'Fri', balance: 243100 },
  { day: 'Sat', balance: 246200 },
  { day: 'Sun', balance: 248420 },
];

export const transactions: Transaction[] = [
  {
    id: 'TX-1024',
    date: 'Mar 07, 2026',
    asset: 'BTC',
    type: 'Buy',
    amount: '$12,450',
    status: 'Completed',
  },
  {
    id: 'TX-1023',
    date: 'Mar 06, 2026',
    asset: 'ETH',
    type: 'Sell',
    amount: '$6,110',
    status: 'Pending',
  },
  {
    id: 'TX-1022',
    date: 'Mar 06, 2026',
    asset: 'USDC',
    type: 'Deposit',
    amount: '$30,000',
    status: 'Completed',
  },
  {
    id: 'TX-1021',
    date: 'Mar 05, 2026',
    asset: 'SOL',
    type: 'Withdraw',
    amount: '$2,300',
    status: 'Failed',
  },
  {
    id: 'TX-1020',
    date: 'Mar 05, 2026',
    asset: 'BTC',
    type: 'Buy',
    amount: '$9,870',
    status: 'Completed',
  },
];

export const latestNews = [
  {
    headline: 'Fed signals stable rates through next quarter',
    time: '2h ago',
  },
  {
    headline: 'Institutional inflows into BTC ETFs remain strong',
    time: '4h ago',
  },
  {
    headline: 'Layer-2 transaction activity climbs week-over-week',
    time: '7h ago',
  },
];
