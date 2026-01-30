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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Users</h1>

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
              <th className="px-4 py-3 text-left">Nickname</th>
              <th className="px-4 py-3 text-left">Age</th>
              <th className="px-4 py-3 text-left">Gender</th>
              <th className="px-4 py-3 text-left">Verified</th>
              <th className="px-4 py-3 text-left">Plus</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tokens</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-background">
                <td className="px-4 py-3 text-sm">{user.id.slice(0, 8)}...</td>
                <td className="px-4 py-3">{user.nickname}</td>
                <td className="px-4 py-3">{user.age}</td>
                <td className="px-4 py-3">{user.gender}</td>
                <td className="px-4 py-3">
                  {user.verified ? '✅' : '❌'}
                </td>
                <td className="px-4 py-3">{user.isPlus ? '⭐' : '-'}</td>
                <td className="px-4 py-3">{user.status}</td>
                <td className="px-4 py-3">{user.tokenBalance}</td>
                <td className="px-4 py-3 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateUser(user.id, { isPlus: !user.isPlus })}
                      className="rounded bg-primary px-2 py-1 text-xs hover:opacity-90"
                    >
                      Toggle Plus
                    </button>
                    <button
                      onClick={() => updateUser(user.id, { verified: !user.verified })}
                      className="rounded bg-primary px-2 py-1 text-xs hover:opacity-90"
                    >
                      Toggle Verified
                    </button>
                    <button
                      onClick={() =>
                        updateUser(user.id, {
                          status: user.status === 'BANNED' ? 'ACTIVE' : 'BANNED',
                        })
                      }
                      className="rounded bg-danger px-2 py-1 text-xs hover:opacity-90"
                    >
                      {user.status === 'BANNED' ? 'Unban' : 'Ban'}
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
