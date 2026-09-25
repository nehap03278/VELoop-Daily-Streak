import { useId } from 'react';

/** VELoop "VR" shield mark (vector, so it stays crisp at any size). */
export default function Logo({ size = 40, className, title = 'VELoop Rewards' }) {
  const gradientId = `vr-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.55" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M32 4 56 12v18c0 15-10 25-24 30C18 55 8 45 8 30V12Z" fill="#1a1030" stroke={`url(#${gradientId})`} strokeWidth="4" strokeLinejoin="round" />
      <text x="32" y="40" textAnchor="middle" fontFamily="Poppins, Arial Black, Arial" fontWeight="900" fontSize="20" fill={`url(#${gradientId})`}>
        VR
      </text>
    </svg>
  );
}
