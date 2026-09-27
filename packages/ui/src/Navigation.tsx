'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Flame,
  Tv,
  CheckCircle2,
  Tags,
  CalendarDays,
  Search,
  Heart,
  History,
  Download,
  Settings,
  User,
  HelpCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/anime/popular', label: 'Popular', icon: Flame },
  { href: '/anime/ongoing', label: 'Ongoing', icon: Tv },
  { href: '/anime/completed', label: 'Completed', icon: CheckCircle2 },
  { href: '/genre', label: 'Genres', icon: Tags },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/history', label: 'History', icon: History },
  { href: '/downloads', label: 'Downloads', icon: Download },
];

const FOOTER_ITEMS = [
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

export function Navigation() {
  const pathname = usePathname();

  const renderLink = (item: (typeof NAV_ITEMS)[number]) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive
              ? 'bg-accent text-white'
              : 'text-subtle hover:bg-surface hover:text-white'
          }`}
        >
          <Icon size={18} />
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="w-60 flex-shrink-0 bg-panel border-r border-border flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-white">Samren</h1>
      </div>
      <ul className="py-2 space-y-1 px-2 flex-1">{NAV_ITEMS.map(renderLink)}</ul>
      <ul className="py-2 space-y-1 px-2 border-t border-border">
        {FOOTER_ITEMS.map(renderLink)}
      </ul>
    </nav>
  );
}
