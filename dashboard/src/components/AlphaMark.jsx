import { useId } from 'react'
export default function AlphaMark({ size = 42, className = '' }) {
  const gradient = useId()
  return <svg className={`alpha-mark ${className}`.trim()} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Alpha by Martech">
    <defs><linearGradient id={gradient} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#22d3ee"/></linearGradient></defs>
    <rect x="3" y="3" width="58" height="58" rx="16" fill="var(--surface-2, #121c2c)" stroke={`url(#${gradient})`} strokeWidth="2"/>
    <path d="M18 46 29 18h6l11 28h-7l-2-6H27l-2 6Zm11-12h6l-3-9Z" fill={`url(#${gradient})`}/>
    <circle cx="47" cy="17" r="3" fill="#22d3ee"/>
  </svg>
}
