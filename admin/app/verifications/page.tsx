'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Poz açıklamaları
const POSE_LABELS: Record<string, string> = {
  THUMBS_UP: '👍 Başparmak Yukarı',
  PEACE_SIGN: '✌️ V İşareti',
  WAVE_HAND: '👋 El Sallama',
  POINT_UP: '☝️ Yukarı İşaret',
  OK_SIGN: '👌 OK İşareti',
};

interface SelfieVerification {
  id: string;
  userId: string;
  user: {
    id: string;
    nickname: string;
    age: number;
    gender: string;
    createdAt: string;
  };
  pose: string;
  poseDescription: string;
  selfieUrl: string;
  createdAt: string;
}

export default function VerificationsPage() {
  const [verifications, setVerifications] = useState<SelfieVerification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    try {
      const res = await api.get('/api/admin/verifications/selfie/pending');
      setVerifications(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/api/admin/verifications/selfie/${id}/approve`);
      fetchVerifications();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const reject = async (id: string, reason: string) => {
    try {
      await api.post(`/api/admin/verifications/selfie/${id}/reject`, { reason });
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
      <h1 className="mb-6 text-3xl font-bold">Bekleyen Doğrulama İstekleri</h1>
      <p className="mb-6 text-textMuted">
        Kullanıcıların gönderdiği selfie fotoğraflarını inceleyin. 
        Gerçek kişi mi, poz doğru mu, sahte/AI fotoğraf mı kontrol edin.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {verifications.map((v) => (
          <div key={v.id} className="rounded-lg bg-surface p-6">
            {/* Kullanıcı Bilgisi */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{v.user?.nickname || 'Bilinmiyor'}</h3>
              <p className="text-sm text-textMuted">
                Yaş: {v.user?.age || '-'} | {v.user?.gender || '-'}
              </p>
              <p className="text-xs text-textMuted">
                Gönderildi: {new Date(v.createdAt).toLocaleString('tr-TR')}
              </p>
            </div>

            {/* İstenen Poz */}
            <div className="mb-3 rounded bg-background px-3 py-2">
              <p className="text-sm font-medium">İstenen Poz:</p>
              <p className="text-lg">{POSE_LABELS[v.pose] || v.poseDescription || v.pose}</p>
            </div>

            {/* Selfie Fotoğrafı */}
            <div className="mb-4">
              <img
                src={v.selfieUrl}
                alt="Doğrulama Selfie"
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: '300px' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x300?text=Foto+Yüklenemedi';
                }}
              />
            </div>

            {/* Kontrol Listesi */}
            <div className="mb-4 rounded bg-background p-3 text-sm">
              <p className="font-medium mb-2">Kontrol Et:</p>
              <ul className="list-disc list-inside text-textMuted space-y-1">
                <li>Gerçek bir insan yüzü var mı?</li>
                <li>İstenen poz yapılmış mı?</li>
                <li>Stock/AI fotoğraf değil mi?</li>
                <li>Yüz net görünüyor mu?</li>
              </ul>
            </div>

            {/* Butonlar */}
            <div className="flex gap-2">
              <button
                onClick={() => approve(v.id)}
                className="flex-1 rounded bg-success px-4 py-2 font-semibold hover:opacity-90"
              >
                ✅ Onayla
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Red sebebi:');
                  if (reason) reject(v.id, reason);
                }}
                className="flex-1 rounded bg-danger px-4 py-2 font-semibold hover:opacity-90"
              >
                ❌ Reddet
              </button>
            </div>
          </div>
        ))}
      </div>

      {verifications.length === 0 && (
        <div className="text-center py-12">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-textMuted">Bekleyen doğrulama isteği yok</p>
        </div>
      )}
    </div>
  );
}
