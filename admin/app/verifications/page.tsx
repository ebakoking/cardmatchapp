'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Verification {
  id: string;
  userId: string;
  user: {
    nickname: string;
    age: number;
    profilePhotos: Array<{ url: string }>;
  };
  verificationVideoUrl: string;
}

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const res = await api.get('/api/admin/verifications/pending');
      setVerifications(res.data.data);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/api/admin/verifications/${id}/approve`);
      fetchVerifications();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const reject = async (id: string, reason: string) => {
    try {
      await api.post(`/api/admin/verifications/${id}/reject`, { reason });
      fetchVerifications();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Pending Verifications</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {verifications.map((v) => (
          <div key={v.id} className="rounded-lg bg-surface p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{v.user.nickname}</h3>
              <p className="text-sm text-textMuted">Age: {v.user.age}</p>
            </div>

            <div className="mb-4">
              <video
                src={v.verificationVideoUrl}
                controls
                className="w-full rounded"
              />
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto">
              {v.user.profilePhotos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo.url}
                  alt={`Photo ${idx + 1}`}
                  className="h-20 w-20 rounded object-cover"
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => approve(v.id)}
                className="flex-1 rounded bg-success px-4 py-2 font-semibold hover:opacity-90"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Rejection reason:');
                  if (reason) reject(v.id, reason);
                }}
                className="flex-1 rounded bg-danger px-4 py-2 font-semibold hover:opacity-90"
              >
                ❌ Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {verifications.length === 0 && (
        <p className="text-center text-textMuted">No pending verifications</p>
      )}
    </div>
  );
}
