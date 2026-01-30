'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/dashboard', label: '📊 Dashboard', icon: '📊' },
  { href: '/users', label: '👥 Users', icon: '👥' },
  { href: '/verifications', label: '✅ Verifications', icon: '✅' },
  { href: '/reports', label: '🚨 Reports', icon: '🚨' },
  { href: '/redeems', label: '💰 Redeems', icon: '💰' },
  { href: '/leaderboard', label: '🏆 Leaderboard', icon: '🏆' },
  { href: '/settings', label: '⚙️ Settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface p-4">
      <h2 className="mb-6 text-xl font-bold">CardMatch Admin</h2>
      <nav>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded px-4 py-2 ${
                  pathname === item.href
                    ? 'bg-primary text-white'
                    : 'hover:bg-background'
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
