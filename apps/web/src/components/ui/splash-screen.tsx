'use client';

import React from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  message?: string;
}

export function SplashScreen({ message = 'Loading StandLens...' }: SplashScreenProps) {
  return (
    <div className="min-h-screen w-full bg-[#0B0B0F] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Abstract Glowing Backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#E5A320]/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex flex-col items-center space-y-6 z-10">
        {/* Branded Logo Icon */}
        <div className="relative w-20 h-20 rounded-2xl bg-[#141418] border border-[#2A2A32] p-4 flex items-center justify-center shadow-2xl">
          <Image
            src="/standlens-icon-512.png"
            alt="StandLens Logo"
            width={64}
            height={64}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        
        {/* Loading Message and Spinner */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#E5A320]/30 border-t-[#E5A320] rounded-full animate-spin" />
            <span className="text-xs font-semibold text-[#F0ECE5] tracking-wider uppercase">
              StandLens
            </span>
          </div>
          <p className="text-[11px] text-[#9B9BA3] font-medium tracking-wide">
            {message}
          </p>
        </div>
      </div>
      {/* Subtle Developer Signature Credit */}
      <div className="absolute bottom-10 left-0 right-0 text-center z-10">
        <p className="text-[10px] text-[#71717A] tracking-wider">
          Created & Built by{' '}
          <a
            href="https://github.com/TamasruPain"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#E5A320] hover:text-[#F5B731] hover:underline transition-colors"
          >
            @TamasruPain
          </a>
        </p>
      </div>
    </div>
  );
}
