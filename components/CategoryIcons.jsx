import React from 'react';

// ── Trading Card Game Icons ────────────────────────────────────────────────────

export const CaptureSphereIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="18" fill="white"/>
    <path d="M2 20 A18 18 0 0 0 38 20 Z" fill="#CE1126"/>
    <circle cx="20" cy="20" r="18" stroke="#1c1c1e" strokeWidth="2" fill="none"/>
    <rect x="2" y="18.5" width="36" height="3" fill="#1c1c1e"/>
    <polygon points="26,20 23,14.8 17,14.8 14,20 17,25.2 23,25.2" fill="white" stroke="#1c1c1e" strokeWidth="1.5"/>
    <circle cx="20" cy="20" r="2.5" fill="#1c1c1e"/>
    <line x1="10" y1="11" x2="12" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="14" y1="8"  x2="15" y2="11.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const ArcaneGemIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <polygon points="20,4 34.3,15.4 28.8,32.1 11.2,32.1 5.7,15.4"
      fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8"/>
    <circle cx="20" cy="6.5" r="3.2" fill="white"/>
    <circle cx="33" cy="16"  r="3.2" fill="#60A5FA"/>
    <circle cx="28" cy="31"  r="3.2" fill="#D1D5DB"/>
    <circle cx="12" cy="31"  r="3.2" fill="#F87171"/>
    <circle cx="7"  cy="16"  r="3.2" fill="#4ADE80"/>
    <circle cx="20" cy="20" r="4.5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4"/>
    <path d="M20 16 V24 M16 20 H24" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const MysticEyeIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M4 19.5 Q20 5 36 19.5 Q20 34 4 19.5 Z" fill="rgba(0,0,0,0.1)" stroke="rgba(60,30,0,0.75)" strokeWidth="2"/>
    <circle cx="20" cy="19.5" r="7" fill="rgba(60,30,0,0.25)" stroke="rgba(60,30,0,0.7)" strokeWidth="1.5"/>
    <circle cx="20" cy="19.5" r="3.2" fill="rgba(20,8,0,0.9)"/>
    <circle cx="17.5" cy="17" r="1.4" fill="rgba(255,255,255,0.45)"/>
    <line x1="4" y1="19.5" x2="1" y2="23" stroke="rgba(60,30,0,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="36" y1="19.5" x2="39" y2="23" stroke="rgba(60,30,0,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="20" cy="31" r="2.2" stroke="rgba(60,30,0,0.6)" strokeWidth="1" fill="none"/>
    <path d="M20 33.2 V37 M17.5 35 H22.5" stroke="rgba(60,30,0,0.6)" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

export const NauticalAnchorIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="8" r="4.5" stroke="white" strokeWidth="2" fill="none"/>
    <line x1="20" y1="12.5" x2="20" y2="34" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="9" y1="17" x2="31" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 34 Q9 34 9 27"  stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M20 34 Q31 34 31 27" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <circle cx="9"  cy="27" r="2.8" fill="white"/>
    <circle cx="31" cy="27" r="2.8" fill="white"/>
  </svg>
);

export const MagicDropIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M20 5 C20 5 31 17 31 24 A11 11 0 0 1 9 24 C9 17 20 5 20 5 Z"
      fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
    <path d="M20 10 C20 10 27 20 27 24" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" fill="none"/>
    <path d="M8 11 L9 8 L10 11 L13 12 L10 13 L9 16 L8 13 L5 12 Z" fill="white" opacity="0.85"/>
    <path d="M32 9 L32.7 7 L33.4 9 L35.4 9.7 L33.4 10.4 L32.7 12.4 L32 10.4 L30 9.7 Z" fill="white" opacity="0.55"/>
    <circle cx="35" cy="22" r="1.4" fill="white" opacity="0.4"/>
  </svg>
);

export const StarOrbIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="21" r="17" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
    <path d="M11 13 Q16 8 23 10" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M20 7 L21.8 18.2 L33 21 L21.8 23.8 L20 35 L18.2 23.8 L7 21 L18.2 18.2 Z" fill="white" opacity="0.9"/>
    <circle cx="20" cy="21" r="2.5" fill="rgba(251,146,60,0.9)"/>
  </svg>
);

export const DigitalBadgeIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M8 5 H22 Q35 5 35 20 Q35 35 22 35 H8 Z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
    <rect x="12" y="10"   width="5" height="5" rx="1" fill="white" opacity="0.9"/>
    <rect x="19" y="10"   width="5" height="5" rx="1" fill="white" opacity="0.5"/>
    <rect x="26" y="12"   width="5" height="5" rx="1" fill="white" opacity="0.7"/>
    <rect x="12" y="17.5" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
    <rect x="19" y="17.5" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
    <rect x="26" y="19.5" width="5" height="5" rx="1" fill="white" opacity="0.5"/>
    <rect x="12" y="25"   width="5" height="5" rx="1" fill="white" opacity="0.7"/>
    <rect x="19" y="25"   width="5" height="5" rx="1" fill="white" opacity="0.5"/>
    <rect x="26" y="27"   width="5" height="5" rx="1" fill="white" opacity="0.9"/>
  </svg>
);

export const CourtBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/>
    <line x1="20" y1="3"  x2="20" y2="37" stroke="white" strokeWidth="1.5"/>
    <line x1="3"  y1="20" x2="37" y2="20" stroke="white" strokeWidth="1.5"/>
    <path d="M20 3 Q10 11 10 20 Q10 29 20 37" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M20 3 Q30 11 30 20 Q30 29 20 37" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M14 20 A6 6 0 0 1 26 20" stroke="white" strokeWidth="1" fill="none" opacity="0.6"/>
  </svg>
);

export const TrophyCupIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M13 5 H27 L25 21 Q23 28 20 28 Q17 28 15 21 Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
    <path d="M13 7 Q5 7 5 14 Q5 22 13 22" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <path d="M27 7 Q35 7 35 14 Q35 22 27 22" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <rect x="18.5" y="28" width="3" height="5" fill="white" opacity="0.85"/>
    <rect x="13"   y="33" width="14" height="3" rx="1.5" fill="white" opacity="0.85"/>
    <path d="M20 10 L21.2 14 L25.3 14 L22 16.5 L23.2 20.5 L20 18 L16.8 20.5 L18 16.5 L14.7 14 L18.8 14 Z" fill="white"/>
  </svg>
);

// ── Additional TCG Icons ───────────────────────────────────────────────────────

export const CrystalIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <polygon points="20,4 30,16 26,36 14,36 10,16" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <line x1="20" y1="4"  x2="10" y2="16" stroke="white" strokeWidth="1" opacity="0.5"/>
    <line x1="20" y1="4"  x2="30" y2="16" stroke="white" strokeWidth="1" opacity="0.5"/>
    <line x1="10" y1="16" x2="30" y2="16" stroke="white" strokeWidth="1" opacity="0.5"/>
    <polygon points="20,4 26,13 20,10" fill="white" opacity="0.45"/>
    <line x1="18" y1="16" x2="16" y2="36" stroke="white" strokeWidth="0.8" opacity="0.4"/>
    <line x1="22" y1="16" x2="24" y2="36" stroke="white" strokeWidth="0.8" opacity="0.4"/>
  </svg>
);

export const RiftPortalIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M16 4 L9 18 L17 18 L10 36"  stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M24 4 L31 18 L23 18 L30 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <ellipse cx="20" cy="20" rx="3.5" ry="9" fill="rgba(255,255,255,0.25)"/>
    <circle  cx="20" cy="20" r="2" fill="white" opacity="0.6"/>
  </svg>
);

export const TurtleShellIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="1.8"/>
    <polygon points="20,11 25,14.5 25,21.5 20,25 15,21.5 15,14.5" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.2"/>
    <polygon points="9,16 14,19.5 14,26.5 9,30 4,26.5 4,19.5"    fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1"/>
    <polygon points="31,16 36,19.5 36,26.5 31,30 26,26.5 26,19.5" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1"/>
  </svg>
);

// ── Sport Icons ───────────────────────────────────────────────────────────────

export const NBLBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/>
    <line x1="20" y1="3"  x2="20" y2="37" stroke="white" strokeWidth="1.5"/>
    <line x1="3"  y1="20" x2="37" y2="20" stroke="white" strokeWidth="1.5"/>
    <path d="M20 3 Q10 11 10 20 Q10 29 20 37" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M20 3 Q30 11 30 20 Q30 29 20 37" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M11 28 A9 9 0 0 0 29 28" stroke="white" strokeWidth="1" fill="none" opacity="0.6"/>
  </svg>
);

export const AmericanFootballIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <ellipse cx="20" cy="20" rx="16" ry="10" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <line x1="20" y1="11" x2="20" y2="29" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="16" y1="16.5" x2="24" y2="16.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="15" y1="20"   x2="25" y2="20"   stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="16" y1="23.5" x2="24" y2="23.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const BaseballIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <path d="M13 5 Q6 12 9 20 Q6 28 13 35" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M27 5 Q34 12 31 20 Q34 28 27 35" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </svg>
);

export const CricketIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M27 4 L32 9 L14 35 L9 30 Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
    <rect x="28" y="1.5" width="5" height="10" rx="2.5" fill="white" opacity="0.75"/>
    <circle cx="9" cy="29" r="6" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
    <path d="M4.5 27 Q9 24 13.5 27" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M4.5 31 Q9 34 13.5 31" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>
);

export const RugbyBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <ellipse cx="20" cy="20" rx="16" ry="11" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <line x1="4" y1="20" x2="36" y2="20" stroke="white" strokeWidth="1.4"/>
    <path d="M4 20 Q12 13 20 20 Q28 27 36 20" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6"/>
    <path d="M4 20 Q12 27 20 20 Q28 13 36 20" stroke="white" strokeWidth="1.2" fill="none" opacity="0.6"/>
  </svg>
);

export const AFLBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <ellipse cx="20" cy="20" rx="13" ry="18" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <line x1="7"  y1="20" x2="33" y2="20" stroke="white" strokeWidth="1.4"/>
    <line x1="20" y1="2"  x2="20" y2="38" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
    <line x1="17" y1="13" x2="23" y2="13" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="17" y1="27" x2="23" y2="27" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const CheckeredFlagIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <line x1="6" y1="4" x2="6" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <rect x="7"  y="4"  width="8" height="8" fill="white" opacity="0.9"/>
    <rect x="15" y="4"  width="8" height="8" fill="white" opacity="0.3"/>
    <rect x="23" y="4"  width="8" height="8" fill="white" opacity="0.9"/>
    <rect x="31" y="4"  width="8" height="8" fill="white" opacity="0.3"/>
    <rect x="7"  y="12" width="8" height="8" fill="white" opacity="0.3"/>
    <rect x="15" y="12" width="8" height="8" fill="white" opacity="0.9"/>
    <rect x="23" y="12" width="8" height="8" fill="white" opacity="0.3"/>
    <rect x="31" y="12" width="8" height="8" fill="white" opacity="0.9"/>
    <rect x="7"  y="20" width="8" height="8" fill="white" opacity="0.9"/>
    <rect x="15" y="20" width="8" height="8" fill="white" opacity="0.3"/>
    <rect x="23" y="20" width="8" height="8" fill="white" opacity="0.9"/>
  </svg>
);

export const GolfIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="13" r="10" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/>
    <circle cx="16.5" cy="10" r="1.5" fill="white" opacity="0.4"/>
    <circle cx="22"   cy="9"  r="1.5" fill="white" opacity="0.4"/>
    <circle cx="25"   cy="14" r="1.5" fill="white" opacity="0.4"/>
    <circle cx="20"   cy="17" r="1.5" fill="white" opacity="0.4"/>
    <circle cx="15"   cy="15" r="1.5" fill="white" opacity="0.4"/>
    <line x1="20" y1="23" x2="20" y2="36" stroke="white" strokeWidth="2"   strokeLinecap="round"/>
    <line x1="15" y1="36" x2="25" y2="36" stroke="white" strokeWidth="2"   strokeLinecap="round"/>
  </svg>
);

export const SoccerBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="1.8"/>
    <polygon points="20,10 27,15 24,23 16,23 13,15" fill="rgba(255,255,255,0.3)" stroke="white" strokeWidth="1.2"/>
    <path d="M20 10 L26 5"  stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M27 15 L35 13" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M24 23 L28 31" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M16 23 L12 31" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M13 15 L5  13"  stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export const TennisBallIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <circle cx="20" cy="20" r="17" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <path d="M4 13 Q14 20 4 27"  stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M36 13 Q26 20 36 27" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

export const ChampionBeltIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <rect x="2" y="14" width="36" height="12" rx="3" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
    <polygon points="20,10 25,16 25,24 20,29 15,24 15,16" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
    <polygon points="20,13 23,17 23,23 20,26 17,23 17,17" fill="white" opacity="0.4"/>
    <rect x="5"  y="17" width="8" height="6" rx="1.5" fill="white" opacity="0.5"/>
    <rect x="27" y="17" width="8" height="6" rx="1.5" fill="white" opacity="0.5"/>
  </svg>
);

export const OctagonIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <polygon points="14,3 26,3 37,14 37,26 26,37 14,37 3,26 3,14" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="2"/>
    <polygon points="16,8 24,8 32,16 32,24 24,32 16,32 8,24 8,16" fill="rgba(255,255,255,0.05)" stroke="white" strokeWidth="1" opacity="0.5"/>
    <line x1="20" y1="13" x2="20" y2="27" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    <line x1="13" y1="20" x2="27" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
  </svg>
);

export const HockeyIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <ellipse cx="20" cy="28" rx="14" ry="7" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8"/>
    <path d="M6 28 L6 31 Q6 37 20 37 Q34 37 34 31 L34 28" stroke="white" strokeWidth="1.5" fill="none"/>
    <path d="M10 5 L24 19" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M6  17 L18 5"  stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M30 5 L16 19" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M34 17 L22 5"  stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

// ── Shop / accessory category icons ────────────────────────────────────────────
// Purpose-built, card-themed glyphs for the "Shop" supplies categories, drawn in
// the same white-on-gradient language as the marketplace icons above so the two
// menus read as one family (a bare lucide Shield/Frame/Truck looked generic next
// to the Pokéball, anchor and basketball on the Browse Collections side).

// Protection — a card guarded inside a shield.
export const CardShieldIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M20 3 L33 8 V19 C33 28 27.5 34 20 37 C12.5 34 7 28 7 19 V8 Z"
      fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
    <rect x="15" y="12.5" width="10" height="13.5" rx="1.5" fill="rgba(255,255,255,0.28)" stroke="white" strokeWidth="1.4"/>
    <path d="M16.8 20 L19 22.2 L23.4 16.8" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

// Storage — cards standing upright in an open box.
export const CardStorageBoxIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <rect x="12.5" y="7"  width="6" height="16" rx="1" fill="white" opacity="0.85"/>
    <rect x="20"   y="5"  width="6" height="18" rx="1" fill="white" opacity="0.55"/>
    <path d="M6 20 H34 V31 Q34 34 31 34 H9 Q6 34 6 31 Z"
      fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M6 20 L9.5 15 H30.5 L34 20" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
);

// Display — a card propped on a stand.
export const CardStandIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <rect x="12" y="4" width="16" height="22" rx="2" fill="rgba(255,255,255,0.22)" stroke="white" strokeWidth="1.8"/>
    <circle cx="20" cy="12" r="3.4" fill="white" opacity="0.7"/>
    <path d="M14 23 L18 17 L21 20 L24 15 L26 23 Z" fill="white" opacity="0.7"/>
    <path d="M20 26 V32" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M12.5 35 Q20 29.5 27.5 35" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </svg>
);

// Shipping — an isometric parcel with a postage label.
export const ShippingParcelIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <path d="M20 4 L34 11 V27 L20 34 L6 27 V11 Z"
      fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M6 11 L20 18 L34 11" stroke="white" strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
    <path d="M20 18 V34" stroke="white" strokeWidth="1.6"/>
    <path d="M13 7.5 L27 14.5" stroke="white" strokeWidth="1.4" opacity="0.55" strokeLinecap="round"/>
    <rect x="14.5" y="22" width="8" height="6" rx="1" fill="white" opacity="0.85"/>
  </svg>
);

// Grading — a slabbed card with a label and a grade star.
export const GradedSlabIcon = ({ className }) => (
  <svg viewBox="0 0 40 40" fill="none" className={className}>
    <rect x="10" y="3.5" width="20" height="33" rx="3" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.8"/>
    <rect x="13" y="6.5" width="14" height="5" rx="1" fill="white" opacity="0.8"/>
    <rect x="13" y="14.5" width="14" height="18.5" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.2"/>
    <path d="M20 17.5 L21.5 20.6 L24.9 21 L22.4 23.3 L23.1 26.6 L20 25 L16.9 26.6 L17.6 23.3 L15.1 21 L18.5 20.6 Z" fill="white"/>
  </svg>
);

// ── Category datasets ──────────────────────────────────────────────────────────

export const TCG_CATEGORY_DATA = [
  { slug: 'pokemon',      name: 'Pokémon',              gradient: 'from-yellow-300 to-yellow-500',   Icon: CaptureSphereIcon  },
  { slug: 'magic',        name: 'Magic: The Gathering', gradient: 'from-purple-500 to-violet-700',   Icon: ArcaneGemIcon      },
  { slug: 'yugioh',       name: 'Yu-Gi-Oh!',            gradient: 'from-amber-300 to-amber-500',     Icon: MysticEyeIcon      },
  { slug: 'dragonball',   name: 'Dragon Ball',          gradient: 'from-orange-400 to-orange-600',   Icon: StarOrbIcon        },
  { slug: 'onepiece',     name: 'One Piece',            gradient: 'from-red-500 to-rose-700',        Icon: NauticalAnchorIcon },
  { slug: 'lorcana',      name: 'Disney Lorcana',       gradient: 'from-blue-400 to-indigo-600',     Icon: MagicDropIcon      },
  { slug: 'digimon',      name: 'Digimon',              gradient: 'from-sky-400 to-cyan-600',        Icon: DigitalBadgeIcon   },
  { slug: 'final-fantasy',name: 'Final Fantasy',        gradient: 'from-sky-500 to-blue-700',        Icon: CrystalIcon        },
  { slug: 'riftbound',    name: 'Riftbound',            gradient: 'from-violet-600 to-purple-800',   Icon: RiftPortalIcon     },
  { slug: 'tmnt',         name: 'TMNT',                 gradient: 'from-green-500 to-green-700',     Icon: TurtleShellIcon    },
];

export const SPORTS_CATEGORY_DATA = [
  { slug: 'nba',       name: 'NBA',       gradient: 'from-blue-700 to-red-600',      Icon: CourtBallIcon          },
  { slug: 'nbl',       name: 'NBL',       gradient: 'from-green-600 to-teal-600',    Icon: NBLBallIcon            },
  { slug: 'nfl',       name: 'NFL',       gradient: 'from-blue-800 to-indigo-600',   Icon: AmericanFootballIcon   },
  { slug: 'mlb',       name: 'MLB',       gradient: 'from-red-500 to-slate-700',     Icon: BaseballIcon           },
  { slug: 'cricket',   name: 'Cricket',   gradient: 'from-lime-500 to-green-700',    Icon: CricketIcon            },
  { slug: 'nrl',       name: 'NRL',       gradient: 'from-sky-600 to-blue-800',      Icon: RugbyBallIcon          },
  { slug: 'afl',       name: 'AFL',       gradient: 'from-red-600 to-yellow-500',    Icon: AFLBallIcon            },
  { slug: 'formula-1', name: 'Formula 1', gradient: 'from-gray-700 to-red-700',      Icon: CheckeredFlagIcon      },
  { slug: 'golf',      name: 'Golf',      gradient: 'from-green-400 to-lime-500',    Icon: GolfIcon               },
  { slug: 'soccer',    name: 'Soccer',    gradient: 'from-emerald-500 to-green-700', Icon: SoccerBallIcon         },
  { slug: 'tennis',    name: 'Tennis',    gradient: 'from-lime-400 to-yellow-500',   Icon: TennisBallIcon         },
  { slug: 'wrestling', name: 'Wrestling', gradient: 'from-yellow-500 to-orange-600', Icon: ChampionBeltIcon       },
  { slug: 'ufc',       name: 'UFC',       gradient: 'from-gray-700 to-red-800',      Icon: OctagonIcon            },
  { slug: 'nhl',       name: 'NHL',       gradient: 'from-slate-700 to-blue-900',    Icon: HockeyIcon             },
];

// All categories shown on the homepage browse carousel
export const HOMEPAGE_CATEGORIES = [
  TCG_CATEGORY_DATA[0], // Pokémon
  TCG_CATEGORY_DATA[1], // Magic: TG
  TCG_CATEGORY_DATA[2], // Yu-Gi-Oh!
  TCG_CATEGORY_DATA[4], // One Piece
  TCG_CATEGORY_DATA[5], // Disney Lorcana
  TCG_CATEGORY_DATA[3], // Dragon Ball
  TCG_CATEGORY_DATA[6], // Digimon
  SPORTS_CATEGORY_DATA[0], // NBA
  SPORTS_CATEGORY_DATA[2], // NFL
  TCG_CATEGORY_DATA[7], // Final Fantasy
  TCG_CATEGORY_DATA[8], // Riftbound
  TCG_CATEGORY_DATA[9], // TMNT
  SPORTS_CATEGORY_DATA[1], // NBL
  SPORTS_CATEGORY_DATA[3], // MLB
  SPORTS_CATEGORY_DATA[4], // Cricket
  SPORTS_CATEGORY_DATA[5], // NRL
  SPORTS_CATEGORY_DATA[6], // AFL
  SPORTS_CATEGORY_DATA[7], // Formula 1
  SPORTS_CATEGORY_DATA[8], // Golf
  SPORTS_CATEGORY_DATA[9], // Soccer
  SPORTS_CATEGORY_DATA[10], // Tennis
  SPORTS_CATEGORY_DATA[11], // Wrestling
  SPORTS_CATEGORY_DATA[12], // UFC
  SPORTS_CATEGORY_DATA[13], // NHL
];
