import { useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import UsageChart from '../components/UsageChart';
import UserTable from '../components/UserTable';

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  monthlyUsage: { totalSeconds: number; totalRequests: number; activeUsers: number };
  planDistribution: Record<string, number>;
  dailyStats: { date: string; seconds: number; requests: number; users: number }[];
  topUsers: {
    userId: string;
    email: string;
    nickname: string | null;
    planId: string;
    totalSeconds: number;
    totalRequests: number;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load stats: {error}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'bg-blue-500' },
    { label: 'Premium Users', value: stats.premiumUsers.toLocaleString(), color: 'bg-purple-500' },
    { label: 'Monthly Requests', value: stats.monthlyUsage.totalRequests.toLocaleString(), color: 'bg-green-500' },
    { label: 'Active Users (Month)', value: stats.monthlyUsage.activeUsers.toLocaleString(), color: 'bg-orange-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${card.color}`} />
              <span className="text-sm text-gray-500">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Plan Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Plan Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.planDistribution).map(([planId, count]) => {
              const total = stats.totalUsers || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={planId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{planId}</span>
                    <span className="text-gray-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <UsageChart data={stats.dailyStats.map(d => ({ date: d.date, count: d.requests }))} label="Daily Usage (Last 30 days)" />
        </div>
      </div>

      {/* Top Users */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Top Users</h2>
        <UserTable users={stats.topUsers.map(u => ({ id: u.userId, email: u.email ?? '', nickname: u.nickname, planId: u.planId, totalSeconds: u.totalSeconds }))} />
      </div>
    </div>
  );
}
