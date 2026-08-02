'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';

export default function DigestsPage() {
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';

  const [loading, setLoading] = useState(true);
  const [groupedDigests, setGroupedDigests] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadDigests() {
      try {
        setLoading(true);
        const res = await apiClient.getGroupedUserDigests(activeUserId);
        if (!isMounted) return;
        setGroupedDigests(res as Record<string, unknown>[]);
      } catch (err) {
        console.error('Failed to load digests:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadDigests();

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title="Digests" backUrl="/dashboard" backLabel="Dashboard" />

        <main className="p-8 space-y-10 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#E5A320] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading AI digests...
            </div>
          ) : groupedDigests.length === 0 ? (
            <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center text-[#9B9BA3] space-y-3">
              <Sparkles className="w-10 h-10 text-[#E5A320] mx-auto" />
              <h3 className="text-lg font-bold text-[#F0ECE5]">No Digests Generated Yet</h3>
              <p className="text-xs text-[#9B9BA3] max-w-md mx-auto">
                Select one of your teams to trigger an AI Digest generation and view executive summaries here!
              </p>
              <Link
                href="/teams"
                className="inline-block bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md mt-2"
              >
                Go to Teams →
              </Link>
            </div>
          ) : (
            groupedDigests.map((group: Record<string, unknown>) => {
              const teamNameStr = (group.teamName as string) || '';
              const digestsArr = (group.digests as Record<string, unknown>[]) || [];

              return (
                <section key={group.teamId as string} className="space-y-4">
                  {/* Group Header */}
                  <div className="flex items-center gap-3 border-b border-[#1F1F26] pb-3">
                    <div className="w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center bg-[#8B5CF6]">
                      {teamNameStr.slice(0, 2).toUpperCase()}
                    </div>
                    <h3 className="font-bold text-base text-[#F0ECE5]">{teamNameStr}</h3>
                    <span className="text-xs text-[#9B9BA3]">({group.companyName as string})</span>
                  </div>

                  {/* Horizontal Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {digestsArr.map((d: Record<string, unknown>) => (
                      <div
                        key={d.id as string}
                        className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#333342] transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#F0ECE5]">
                              {new Date(d.digestDate as string).toLocaleDateString()}
                            </span>
                            <div className="p-1.5 rounded-lg bg-[#A855F7]/10 text-[#A855F7]">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <p className="text-xs text-[#D1D1D6] mt-3 line-clamp-3 leading-relaxed">
                            {d.summary as string}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#23232C] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#1C1C24] text-[#9B9BA3]">
                              {d.standupCount as number} standups
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#1C1C24] text-[#9B9BA3]">
                              {d.aiModel as string}
                            </span>
                          </div>
                          <Link
                            href={`/teams/${group.teamId as string}?tab=digest`}
                            className="text-[#E5A320] font-bold hover:underline flex items-center gap-1"
                          >
                            View Full <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}
