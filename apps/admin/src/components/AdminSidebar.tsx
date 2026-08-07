'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminNav = [
  { label: 'Dashboard', href: '/', icon: '📊' },
  { label: 'Anime', href: '/anime', icon: '🎬' },
  { label: 'Genres', href: '/genres', icon: '🏷️' },
  { label: 'Schedule', href: '/schedule', icon: '📅' },
  { label: 'Downloads', href: '/downloads', icon: '⬇' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Samren Admin</h1>
      </div>
      <ul className="py-2 space-y-1 px-2">
        {adminNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
