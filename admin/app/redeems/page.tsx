'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Redeem {
  id: string;
  user: { nickname: string };
  requestedAmount: number;
  bankAccount: string;
  status: string;
  createdAt: string;
}

export default function RedeemsPage() {
  const [redeems, setRedeems] = useState<Redeem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRedeems();
  }, []);

  const fetchRedeems = async () => {
    try {
      const res = await api.get('/api/admin/redeems');
      setRedeems(res.data.data);
    } catch (error) {
      console.error('Failed to fetch redeems:', error);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    const note = prompt('Admin note (e.g., transfer date):');
    if (!note) return;

    try {
      await api.post(`/api/admin/redeems/${id}/approve`, { adminNote: note });
      fetchRedeems();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const reject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    try {
      await api.post(`/api/admin/redeems/${id}/reject`, { reason });
      fetchRedeems();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Redeem Requests</h1>

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-background">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Token Amount</th>
              <th className="px-4 py-3 text-left">IBAN</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {redeems.map((redeem) => (
              <tr key={redeem.id} className="border-b border-background">
                <td className="px-4 py-3">{redeem.user.nickname}</td>
                <td className="px-4 py-3">{redeem.requestedAmount}</td>
                <td className="px-4 py-3 font-mono text-sm">
                  {redeem.bankAccount}
                </td>
                <td className="px-4 py-3">{redeem.status}</td>
                <td className="px-4 py-3 text-sm">
                  {new Date(redeem.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {redeem.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approve(redeem.id)}
                          className="rounded bg-success px-2 py-1 text-xs hover:opacity-90"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reject(redeem.id)}
                          className="rounded bg-danger px-2 py-1 text-xs hover:opacity-90"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
