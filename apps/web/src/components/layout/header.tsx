'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, ArrowLeft, Check } from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { apiClient, API_BASE_URL } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  backUrl?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'JOIN_REQUEST' | 'REQUEST_APPROVED' | 'REQUEST_DECLINED' | 'DIGEST_READY' | 'STANDUP_REMINDER';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export function Header({ title, backUrl, backLabel, action }: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const user = session?.user || {
    name: 'Tamas Varga',
    email: 'tamas@acmecorp.com',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  // 1. Initial Load of Notifications
  useEffect(() => {
    let isMounted = true;
    if (!activeUserId) return;

    apiClient.getNotifications(activeUserId)
      .then((res) => {
        if (isMounted) {
          setNotifications(res as unknown as NotificationItem[]);
        }
      })
      .catch((err) => {
        console.error('Failed to load notifications:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  // 2. Setup Real-time SSE Alerts Connection
  useEffect(() => {
    let isMounted = true;
    if (!activeUserId) return;

    const eventSource = new EventSource(`${API_BASE_URL}/notifications/sse/${activeUserId}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Dispatch a global window event for pages to update real-time
        window.dispatchEvent(new CustomEvent('notifications-sse', { detail: payload }));

        if (payload.type === 'STANDUP_SUBMITTED') {
          const userName = payload.standup?.user?.name || payload.standup?.user?.email || 'A team member';
          toast.info('Standup Submitted', `${userName} submitted their standup entry`);
          return;
        }

        if (payload.type === 'MEMBER_REMOVED') {
          toast.error('Removed from Team', `You have been removed from team workspace: ${payload.teamName || ''}`);
          return;
        }

        if (payload.type === 'ROLE_UPDATED') {
          if (payload.userId === activeUserId) {
            toast.success('Role Updated', `Your role was updated to ${payload.role}`);
          }
          return;
        }

        // Show live browser toast notification alert
        toast.info(payload.title || 'New Update', payload.message || '');

        if (isMounted) {
          // Prepend to state list and prevent duplicates
          setNotifications((prev) => {
            if (prev.some((n) => n.id === payload.id)) return prev;
            return [payload, ...prev];
          });
        }
      } catch (err) {
        console.error('Failed to parse SSE notification:', err);
      }
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [activeUserId, toast]);

  // 3. Mark Single Notification as Read and Redirect
  const handleNotificationClick = async (n: NotificationItem) => {
    try {
      if (!n.isRead) {
        await apiClient.markNotificationAsRead(activeUserId, n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
      }
      setIsOpen(false);
      if (n.link) {
        router.push(n.link);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // 4. Mark All as Read
  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead(activeUserId);
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const validNotifications = notifications.filter((n) => n && n.title && n.message);
  const unreadCount = validNotifications.filter((n) => !n.isRead).length;

  return (
    <header className="h-16 border-b border-[#1F1F26] px-8 flex items-center justify-between bg-[#0B0B0F]/80 backdrop-blur-md sticky top-0 z-10 select-none">
      <div className="flex items-center gap-3">
        {backUrl ? (
          <Link
            href={backUrl}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#9B9BA3] hover:text-[#E5A320] bg-[#14141A] hover:bg-[#1C1C24] border border-[#23232C] px-3 py-1.5 rounded-xl transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel || 'Back'}</span>
          </Link>
        ) : (
          <button
            onClick={() => router.back()}
            className="hidden group-data-[has-history=true]:flex items-center gap-1.5 text-xs font-semibold text-[#9B9BA3] hover:text-[#E5A320] bg-[#14141A] hover:bg-[#1C1C24] border border-[#23232C] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}

        <h1 className="text-xl font-bold text-[#F0ECE5] tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4 relative">
        {action}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-9 h-9 rounded-xl bg-[#14141A] border border-[#23232C] flex items-center justify-center text-[#9B9BA3] hover:text-[#F0ECE5] hover:border-[#333340] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E5A320]" />
            )}
          </button>

          {isOpen && (
            <>
              {/* Overlay to close popover on click outside */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

              <div className="absolute right-0 mt-2 w-80 bg-[#14141A] border border-[#23232C] rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 border-b border-[#23232C] flex items-center justify-between">
                  <span className="font-bold text-sm text-[#F0ECE5]">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-[#E5A320] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {validNotifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[#9B9BA3]">
                      No notifications yet
                    </div>
                  ) : (
                    validNotifications.map((n) => {
                      const isUnread = !n.isRead;
                      return (
                        <div
                          key={n.id}
                          onClick={() => void handleNotificationClick(n)}
                          className={cn(
                            'px-4 py-3 border-b border-[#1C1C24] hover:bg-[#1C1C24]/50 transition-colors flex flex-col gap-1 cursor-pointer relative',
                            isUnread && 'bg-[#E5A320]/5',
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="w-1.5 h-1.5 rounded-full bg-[#E5A320] mt-1.5 shrink-0"
                              style={{ opacity: isUnread ? 1 : 0 }}
                            />
                            <div className="flex-1">
                              <h5 className="text-xs font-bold text-[#F0ECE5]">{n.title}</h5>
                              <p className="text-[11px] text-[#9B9BA3] mt-0.5 leading-relaxed">{n.message}</p>
                              <p className="text-[9px] text-[#555566] mt-1">
                                {new Date(n.createdAt).toLocaleDateString()} ·{' '}
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="px-4 py-2 border-t border-[#23232C] text-center">
                  <Link
                    href="/teams"
                    onClick={() => setIsOpen(false)}
                    className="text-[10px] font-bold text-[#E5A320] hover:underline"
                  >
                    View all team workspaces
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-9 h-9 rounded-full bg-[#5B46F6] text-[#F0ECE5] font-semibold text-xs flex items-center justify-center cursor-pointer shadow-inner hover:opacity-90 transition-opacity"
          >
            {getInitials(user.name || 'User')}
          </button>

          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />

              <div className="absolute right-0 mt-2 w-56 bg-[#14141A]/95 backdrop-blur-md border border-[#23232C] rounded-[24px] shadow-2xl z-50 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center gap-3 border-b border-[#23232C] pb-3">
                  <div className="w-10 h-10 rounded-full bg-[#5B46F6] text-[#F0ECE5] font-bold text-sm flex items-center justify-center shrink-0 shadow-inner">
                    {getInitials(user.name || 'User')}
                  </div>
                  <div className="overflow-hidden text-left">
                    <h4 className="text-xs font-bold text-[#F0ECE5] truncate leading-tight">
                      {user.name || 'Developer'}
                    </h4>
                    <p className="text-[10px] text-[#9B9BA3] truncate leading-tight mt-1">
                      {user.email || 'user@standlens.com'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full bg-[#F87171]/10 hover:bg-[#F87171] hover:text-[#0B0B0F] border border-[#F87171]/20 text-[#F87171] font-bold text-xs py-2 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
