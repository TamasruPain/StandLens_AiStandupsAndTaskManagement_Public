'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { CheckCircle2, Loader2, Filter, Calendar } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function MyStandupsPage() {
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';

  const [loading, setLoading] = useState(true);
  const [standups, setStandups] = useState<Record<string, unknown>[]>([]);

  // Date Filter state
  const [dateMode, setDateMode] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState('');

  const loadMyStandups = async (mode: 'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM', selectedCustomDate?: string) => {
    try {
      setLoading(true);
      setDateMode(mode);
      let dateParam: string | undefined = undefined;

      if (mode === 'TODAY') {
        dateParam = new Date().toISOString().split('T')[0];
      } else if (mode === 'YESTERDAY') {
        const y = new Date(Date.now() - 86400000);
        dateParam = y.toISOString().split('T')[0];
      } else if (mode === 'ALL') {
        dateParam = 'ALL';
      } else if (mode === 'CUSTOM' && selectedCustomDate) {
        dateParam = selectedCustomDate;
      }

      const res = await apiClient.getMyStandups(activeUserId, undefined, dateParam);
      setStandups(res as Record<string, unknown>[]);
    } catch (err) {
      console.error('Failed to load my standups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    apiClient.getMyStandups(activeUserId, undefined, 'ALL')
      .then((res) => {
        if (isMounted) setStandups(res as Record<string, unknown>[]);
      })
      .catch((err) => {
        console.error('Failed to load my standups:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title="My Standups" backUrl="/dashboard" backLabel="Dashboard" />

        <main className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Day-to-Day Date Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#14141A] border border-[#23232C] rounded-2xl p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-[#E5A320]" />
              <span className="text-xs font-bold text-[#F0ECE5] mr-1">Filter Date:</span>
              <button
                type="button"
                onClick={() => void loadMyStandups('ALL')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateMode === 'ALL'
                    ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                    : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                )}
              >
                All History
              </button>
              <button
                type="button"
                onClick={() => void loadMyStandups('TODAY')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateMode === 'TODAY'
                    ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                    : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                )}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => void loadMyStandups('YESTERDAY')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  dateMode === 'YESTERDAY'
                    ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                    : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                )}
              >
                Yesterday
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#9B9BA3]" />
              <span className="text-xs text-[#9B9BA3]">Custom Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) {
                    void loadMyStandups('CUSTOM', e.target.value);
                  }
                }}
                className="bg-[#1C1C24] border border-[#23232C] rounded-xl px-3 py-1.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#E5A320] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading your standups...
            </div>
          ) : standups.length === 0 ? (
            <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center text-[#9B9BA3] space-y-3">
              <h3 className="text-lg font-bold text-[#F0ECE5]">No Standups Found</h3>
              <p className="text-xs text-[#9B9BA3] max-w-md mx-auto">
                No standup submissions match your selected date filter. Select a team to submit a new entry!
              </p>
              <Link
                href="/teams"
                className="inline-block bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md mt-2"
              >
                Go to Teams →
              </Link>
            </div>
          ) : (
            standups.map((s: Record<string, unknown>) => {
              const teamInfo = s.team as { name?: string } | undefined;
              return (
                <div
                  key={s.id as string}
                  className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-4 hover:border-[#333342] transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full text-white font-bold text-xs flex items-center justify-center bg-[#8B5CF6]">
                        {teamInfo?.name ? teamInfo.name.slice(0, 2).toUpperCase() : 'TM'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#F0ECE5]">{teamInfo?.name || 'Team'}</h4>
                        <p className="text-xs text-[#9B9BA3]">
                          {new Date(s.standupDate as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                    </span>
                  </div>

                  {/* Submitted Content */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                        Yesterday
                      </span>
                      <p className="text-[#D1D1D6] leading-relaxed bg-[#1C1C24] p-3.5 rounded-xl">
                        {s.yesterday as string}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                        Today
                      </span>
                      <p className="text-[#D1D1D6] leading-relaxed bg-[#1C1C24] p-3.5 rounded-xl">
                        {s.today as string}
                      </p>
                    </div>

                    <div>
                      <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                        Blockers
                      </span>
                      {s.blockers ? (
                        <p className="text-[#F87171] leading-relaxed bg-[#F87171]/10 border border-[#F87171]/20 p-3.5 rounded-xl">
                          {s.blockers as string}
                        </p>
                      ) : (
                        <p className="text-[#9B9BA3] bg-[#1C1C24] p-3.5 rounded-xl">None</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
