'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  nickname: string;
  age: number;
  gender: string;
  verified: boolean;
  isPlus: boolean;
  isPrime: boolean;
  status: string;
  tokenBalance: number;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    verified: '',
    isPlus: '',
    status: '',
  });
  
  // Elmas ekleme modal
  const [diamondModal, setDiamondModal] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [diamondAmount, setDiamondAmount] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [search, filters]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filters.verified) params.append('verified', filters.verified);
      if (filters.isPlus) params.append('isPlus', filters.isPlus);
      if (filters.status) params.append('status', filters.status);

      const res = await api.get(`/api/admin/users?${params}`);
      setUsers(res.data.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    try {
      await api.patch(`/api/admin/users/${id}`, data);
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  // Elmas ekleme fonksiyonu
  const addDiamonds = async () => {
    if (!diamondModal.user || !diamondAmount) return;
    
    const amount = parseInt(diamondAmount);
    if (isNaN(amount)) {
      alert('Geçerli bir sayı girin');
      return;
    }
    
    try {
      const newBalance = diamondModal.user.tokenBalance + amount;
      await api.patch(`/api/admin/users/${diamondModal.user.id}`, { 
        tokenBalance: newBalance 
      });
      fetchUsers();
      setDiamondModal({ open: false, user: null });
      setDiamondAmount('');
      alert(`${amount} elmas eklendi! Yeni bakiye: ${newBalance}`);
    } catch (error) {
      console.error('Failed to add diamonds:', error);
      alert('Elmas eklenirken hata oluştu');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      {/* Elmas Ekleme Modal */}
      {diamondModal.open && diamondModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-96 rounded-lg bg-surface p-6">
            <h2 className="mb-4 text-xl font-bold">💎 Elmas Ekle</h2>
            <p className="mb-2 text-gray-400">
              Kullanıcı: <span className="text-white">{diamondModal.user.nickname}</span>
            </p>
            <p className="mb-4 text-gray-400">
              Mevcut Bakiye: <span className="text-yellow-400">{diamondModal.user.tokenBalance} 💎</span>
            </p>
            <input
              type="number"
              placeholder="Eklenecek miktar..."
              value={diamondAmount}
              onChange={(e) => setDiamondAmount(e.target.value)}
              className="mb-4 w-full rounded bg-background px-4 py-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDiamondAmount('100')}
                className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
              >
                +100
              </button>
              <button
                onClick={() => setDiamondAmount('500')}
                className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
              >
                +500
              </button>
              <button
                onClick={() => setDiamondAmount('1000')}
                className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
              >
                +1000
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setDiamondModal({ open: false, user: null });
                  setDiamondAmount('');
                }}
                className="rounded bg-gray-600 px-4 py-2 hover:bg-gray-500"
              >
                İptal
              </button>
              <button
                onClick={addDiamonds}
                className="rounded bg-yellow-600 px-4 py-2 hover:bg-yellow-500"
              >
                💎 Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">👥 Kullanıcılar</h1>
        <div className="rounded-lg bg-surface px-4 py-2">
          <span className="text-gray-400">Toplam: </span>
          <span className="font-bold text-primary">{users.length}</span>
          <span className="text-gray-400"> kullanıcı</span>
        </div>
      </div>

      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search by nickname..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded bg-surface px-4 py-2"
        />
        <select
          value={filters.verified}
          onChange={(e) => setFilters({ ...filters, verified: e.target.value })}
          className="rounded bg-surface px-4 py-2"
        >
          <option value="">All Verified</option>
          <option value="true">Verified</option>
          <option value="false">Not Verified</option>
        </select>
        <select
          value={filters.isPlus}
          onChange={(e) => setFilters({ ...filters, isPlus: e.target.value })}
          className="rounded bg-surface px-4 py-2"
        >
          <option value="">All Plus</option>
          <option value="true">Plus</option>
          <option value="false">Not Plus</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="rounded bg-surface px-4 py-2"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SHADOWBANNED">Shadowbanned</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg bg-surface">
        <table className="w-full">
          <thead>
            <tr className="border-b border-background">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Kullanıcı</th>
              <th className="px-4 py-3 text-left">Yaş</th>
              <th className="px-4 py-3 text-left">Cinsiyet</th>
              <th className="px-4 py-3 text-left">Onay</th>
              <th className="px-4 py-3 text-left">Plus</th>
              <th className="px-4 py-3 text-left">Durum</th>
              <th className="px-4 py-3 text-left">💎 Elmas</th>
              <th className="px-4 py-3 text-left">Kayıt</th>
              <th className="px-4 py-3 text-left">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-background">
                <td className="px-4 py-3 text-sm">{user.id.slice(0, 8)}...</td>
                <td className="px-4 py-3">{user.nickname}</td>
                <td className="px-4 py-3">{user.age}</td>
                <td className="px-4 py-3">
                  {user.gender === 'MALE' ? '👨 Erkek' : user.gender === 'FEMALE' ? '👩 Kadın' : user.gender}
                </td>
                <td className="px-4 py-3">
                  {user.verified ? '✅' : '❌'}
                </td>
                <td className="px-4 py-3">{user.isPlus ? '⭐' : '-'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs ${
                    user.status === 'ACTIVE' ? 'bg-green-600' : 
                    user.status === 'BANNED' ? 'bg-red-600' : 'bg-yellow-600'
                  }`}>
                    {user.status === 'ACTIVE' ? '✅ Aktif' : 
                     user.status === 'BANNED' ? '🚫 Banlı' : '👻 Gölge'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-yellow-400">{user.tokenBalance}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDiamondModal({ open: true, user })}
                      className="rounded bg-yellow-600 px-2 py-1 text-xs hover:bg-yellow-500"
                    >
                      💎 Elmas
                    </button>
                    <button
                      onClick={() => updateUser(user.id, { isPlus: !user.isPlus })}
                      className="rounded bg-primary px-2 py-1 text-xs hover:opacity-90"
                    >
                      {user.isPlus ? '⭐ Plus' : 'Plus'}
                    </button>
                    <button
                      onClick={() => updateUser(user.id, { verified: !user.verified })}
                      className="rounded bg-green-600 px-2 py-1 text-xs hover:bg-green-500"
                    >
                      {user.verified ? '✅ Onaylı' : 'Onayla'}
                    </button>
                    <button
                      onClick={() =>
                        updateUser(user.id, {
                          status: user.status === 'BANNED' ? 'ACTIVE' : 'BANNED',
                        })
                      }
                      className="rounded bg-danger px-2 py-1 text-xs hover:opacity-90"
                    >
                      {user.status === 'BANNED' ? '🔓 Aç' : '🚫 Ban'}
                    </button>
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
