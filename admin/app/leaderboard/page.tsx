'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface LeaderboardEntry {
  id: string;
  nickname: string;
  profilePhoto?: string;
  monthlyTokensReceived: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/api/admin/leaderboard');
      setEntries(res.data.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetLeaderboard = async () => {
    try {
      await api.post('/api/admin/leaderboard/reset');
      fetchLeaderboard();
      setShowResetModal(false);
    } catch (error) {
      console.error('Failed to reset leaderboard:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <button
          onClick={() => setShowResetModal(true)}
          className="rounded bg-danger px-4 py-2 font-semibold hover:opacity-90"
        >
          Reset Monthly Leaderboard
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-background">
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Nickname</th>
              <th className="px-4 py-3 text-left">Monthly Tokens</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.id} className="border-b border-background">
                <td className="px-4 py-3">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && index + 1}
                </td>
                <td className="px-4 py-3">{entry.nickname}</td>
                <td className="px-4 py-3">{entry.monthlyTokensReceived}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-surface p-6">
            <h2 className="mb-4 text-xl font-bold">Reset Leaderboard</h2>
            <p className="mb-6 text-textMuted">
              Tüm kullanıcıların aylık jetonları sıfırlanacak. Emin misiniz?
            </p>
            <div className="flex gap-2">
              <button
                onClick={resetLeaderboard}
                className="flex-1 rounded bg-danger px-4 py-2 hover:opacity-90"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 rounded bg-textMuted px-4 py-2 hover:opacity-90"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
