import React from 'react';
import { cn } from '@/lib/utils';

const VaultLogo = ({ className }) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg 
        viewBox="0 0 200 200" 
        className={cn("w-full h-full drop-shadow-xl group", className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Outer Ring Dark Steel Gradient */}
          <linearGradient id="door-outer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          
          {/* Inner Door Bright Chrome/Steel Gradient */}
          <radialGradient id="door-inner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="60%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          
          {/* Small Metallic Bolts Gradient */}
          <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          
          {/* Center Dial Steel Gradient */}
          <radialGradient id="dial-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="70%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
          
          {/* Golden Spokes Accent Gradient */}
          <linearGradient id="gold-spoke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="80%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Filters for 3D Depth */}
          <filter id="shadow-sm">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.5" />
          </filter>
          <filter id="shadow-md">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.6" />
          </filter>
          <filter id="inset-shadow">
            <feOffset dx="0" dy="3"/>
            <feGaussianBlur stdDeviation="4" result="offset-blur"/>
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
            <feFlood floodColor="black" floodOpacity="0.6" result="color"/>
            <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
            <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
          </filter>
        </defs>

        {/* Main Circular Frame */}
        <circle cx="100" cy="100" r="98" fill="url(#door-outer)" filter="url(#shadow-md)" />
        
        {/* Inner Vault Door */}
        <circle cx="100" cy="100" r="82" fill="url(#door-inner)" stroke="#1e293b" strokeWidth="2" filter="url(#inset-shadow)" className="transition-all duration-700 group-hover:brightness-110" />
        
        {/* Decorative Concentric Rings */}
        <circle cx="100" cy="100" r="68" fill="none" stroke="#475569" strokeWidth="1.5" opacity="0.6" />
        <circle cx="100" cy="100" r="55" fill="none" stroke="#475569" strokeWidth="3" opacity="0.4" />

        {/* Perimeter Locking Bolts */}
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={`outer-bolt-${i}`} transform={`rotate(${i * 45} 100 100)`}>
            <circle cx="100" cy="26" r="6" fill="url(#bolt-grad)" filter="url(#shadow-sm)" />
            {/* Bolt Indentation Detail */}
            <circle cx="100" cy="26" r="2.5" fill="#0f172a" opacity="0.4" />
          </g>
        ))}

        {/* Center Mechanism Base */}
        <circle cx="100" cy="100" r="42" fill="url(#door-outer)" filter="url(#shadow-sm)" />
        <circle cx="100" cy="100" r="36" fill="url(#dial-center)" filter="url(#inset-shadow)" />

        {/* Rotating Dial & Spokes Group */}
        <g 
          style={{ transformOrigin: '100px 100px' }}
          className="transition-transform duration-[1200ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[144deg]"
        >
          {/* Dial Ticks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line 
              key={`tick-${i}`}
              x1="100" y1="68" x2="100" y2="72" 
              stroke="#e2e8f0" strokeWidth={i % 3 === 0 ? "2.5" : "1"}
              opacity={i % 3 === 0 ? "0.9" : "0.5"}
              transform={`rotate(${i * 30} 100 100)`}
            />
          ))}

          {/* 3 Golden Spokes */}
          {Array.from({ length: 3 }).map((_, i) => (
            <g key={`spoke-${i}`} transform={`rotate(${i * 120} 100 100)`}>
              <rect x="95" y="15" width="10" height="40" rx="5" fill="url(#gold-spoke)" filter="url(#shadow-md)" />
              {/* Spoke Highlight */}
              <rect x="96.5" y="17" width="2" height="36" rx="1" fill="#fef08a" opacity="0.6" />
            </g>
          ))}

          {/* Central Hub */}
          <circle cx="100" cy="100" r="20" fill="url(#door-outer)" filter="url(#shadow-md)" />
          <circle cx="100" cy="100" r="14" fill="url(#bolt-grad)" />
          <circle cx="100" cy="100" r="6" fill="#0f172a" opacity="0.3" filter="url(#inset-shadow)" />
        </g>
      </svg>

      {/* Australia Text */}
      <h2 className="text-center font-heading font-bold text-lg sm:text-xl md:text-2xl tracking-widest text-foreground drop-shadow-sm">
        AUSTRALIA
      </h2>
    </div>
  );
};

export default VaultLogo;