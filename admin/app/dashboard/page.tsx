'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Stats {
  totalUsers: number;
  verifiedUsers: number;
  verifiedPercentage: number;
  activeSessions: number;
  matchesToday: number;
  revenueThisMonth: number;
  pendingVerifications: number;
  pendingReports: number;
  pendingRedeems: number;
  dailyActiveUsers: Array<{ date: string; count: number }>;
  newSignups: Array<{ date: string; count: number }>;
  revenueOverTime: Array<{ date: string; revenue: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/stats');
        setStats(res.data.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!stats) {
    return <div className="p-8">Failed to load stats</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon="👥"
        />
        <StatCard
          title="Verified Users"
          value={`${stats.verifiedUsers.toLocaleString()} (${stats.verifiedPercentage}%)`}
          icon="✅"
        />
        <StatCard
          title="Active Sessions"
          value={stats.activeSessions}
          icon="💬"
        />
        <StatCard
          title="Matches Today"
          value={stats.matchesToday}
          icon="💕"
        />
        <StatCard
          title="Revenue This Month"
          value={`₺${stats.revenueThisMonth.toLocaleString()}`}
          icon="💰"
        />
        <StatCard
          title="Pending Verifications"
          value={stats.pendingVerifications}
          icon="⏳"
        />
        <StatCard
          title="Pending Reports"
          value={stats.pendingReports}
          icon="🚨"
        />
        <StatCard
          title="Pending Redeems"
          value={stats.pendingRedeems}
          icon="💸"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold">Daily Active Users</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.dailyActiveUsers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6C5CE7" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-surface p-6">
          <h2 className="mb-4 text-xl font-semibold">New Signups</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.newSignups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#00D2D3" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-surface p-6 lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold">Revenue Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.revenueOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#2EE59D"
                fill="#2EE59D"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
