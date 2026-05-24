import React from 'react';
import { cn } from '@/lib/utils';

const RCBadge = ({ size = 'small', className }) => {
  // Reduced to 40-50% of original size for a much more subtle, professional look
  const dimensions = size === 'large' ? { width: 40, height: 48 } : { width: 28, height: 34 };
  
  return (
    <div 
      className={cn("relative z-20 drop-shadow-sm", className)}
      style={{ width: dimensions.width, height: dimensions.height }}
      aria-label="Rookie Card"
    >
      <svg 
        viewBox="0 0 100 120" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Minimal Shield Background */}
        <path 
          d="M 50 15 L 90 28 V 65 C 90 95 50 115 50 115 C 50 115 10 95 10 65 V 28 Z" 
          fill="#0B1C3D" 
        />
        
        {/* Inner minimal border */}
        <path 
          d="M 50 20 L 85 31 V 64 C 85 88 50 108 50 108 C 50 108 15 88 15 64 V 31 Z" 
          fill="none" 
          stroke="#FFB81C" 
          strokeWidth="2.5"
        />

        {/* Minimal Basketball Top Icon */}
        <circle cx="50" cy="15" r="14" fill="#F58216" />
        <path d="M38 15 H62 M50 3 V27 M43 7 Q55 15 43 23 M57 7 Q45 15 57 23" stroke="#0B1C3D" strokeWidth="1.5" fill="none" />

        {/* RC Text - cleaner, no heavy drop shadow */}
        <text 
          x="50" 
          y="76" 
          fontFamily="Arial, sans-serif" 
          fontSize="42" 
          fontWeight="900" 
          fill="#FFB81C" 
          textAnchor="middle" 
          letterSpacing="1"
        >
          RC
        </text>
      </svg>
    </div>
  );
};

export default RCBadge;