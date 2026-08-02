'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ClipboardList,
  Sparkles,
  Settings,
  Menu,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth-client';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Teams', href: '/teams', icon: Users },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'My Standups', href: '/standups/me', icon: ClipboardList },
  { name: 'Digests', href: '/digests', icon: Sparkles },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);


  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  return (
    <aside
      className={cn(
        'bg-[#0F0F14] border-r border-[#1F1F26] flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      {/* Top Header & Logo */}
      <div>
        <div
          className={cn(
            'flex items-center justify-between p-5 border-b border-[#1F1F26]',
            isCollapsed && 'justify-center p-4',
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#141418] border border-[#2A2A32] p-1 flex items-center justify-center shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/standlens-icon-512.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg text-[#F0ECE5] tracking-tight">StandLens</span>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1 rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* When collapsed, show a center-aligned Menu button on top */}
        {isCollapsed && (
          <div className="flex justify-center p-3 border-b border-[#1F1F26]/30">
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-[#9B9BA3] hover:text-[#F0ECE5] p-2 rounded-xl bg-[#16161D] border border-[#23232C] transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className={cn('p-3 space-y-1 mt-2', isCollapsed && 'p-2 space-y-2')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150',
                  isActive
                    ? 'bg-[#1C1C24] text-[#E5A320] shadow-sm border border-[#2A2A35]'
                    : 'text-[#9B9BA3] hover:text-[#F0ECE5] hover:bg-[#16161D]',
                  isCollapsed && 'justify-center px-0 py-3 rounded-xl',
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#E5A320]' : 'text-[#9B9BA3]')} />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Creator Card & Log Out */}
      <div className={cn('p-4 border-t border-[#1F1F26] relative flex items-center justify-between gap-2', isCollapsed && 'p-2 flex-col justify-center')}>
        <a 
          href="https://github.com/TamasruPain" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 flex-1 min-w-0 group"
          title="Creator @TamasruPain"
        >
          <div className="w-8 h-8 rounded-lg bg-[#E5A320]/10 border border-[#E5A320]/20 flex items-center justify-center shrink-0 text-[#E5A320] text-xs font-semibold">
            🚀
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden text-left flex-1 min-w-0">
              <span className="text-[9px] font-extrabold uppercase text-[#E5A320] tracking-widest block leading-tight">Creator</span>
              <span className="text-[11px] font-bold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors duration-200 block truncate">@TamasruPain</span>
            </div>
          )}
        </a>

        <button
          onClick={handleLogout}
          className={cn(
            "p-2 bg-[#F87171]/5 hover:bg-[#F87171] text-[#F87171] hover:text-[#0B0B0F] border border-[#F87171]/10 rounded-xl transition-all cursor-pointer shrink-0",
            isCollapsed && "mt-2 p-1.5"
          )}
          title="Log Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
