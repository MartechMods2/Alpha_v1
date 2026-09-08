export default function AlphaMark({ size = 42, className = '' }) {
  return (
    <svg
      className={`alpha-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Alpha by Martech"
    >
      <defs>
        <linearGradient id="alphaMarkGradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6d5dfc" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="alphaMarkGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M32 3.5 55.5 17v30L32 60.5 8.5 47V17L32 3.5Z"
        fill="url(#alphaMarkGradient)"
        opacity="0.18"
      />
      <path
        d="M32 4.8 54.4 17.7v28.6L32 59.2 9.6 46.3V17.7L32 4.8Z"
        fill="none"
        stroke="url(#alphaMarkGradient)"
        strokeWidth="2"
        opacity="0.9"
      />
      <path
        d="m31.7 14-12 32h7l2.2-6.4h12.4l2.4 6.4H51L38.6 14h-6.9Zm-.5 19.3 3.7-10.8 4 10.8h-7.7Z"
        fill="currentColor"
        filter="url(#alphaMarkGlow)"
      />
      <path d="m39.7 17.2 8.1-4.5-2.7 7.4 5.5 1.2-9.7 8.5 2.9-7.2-5.2-1.2 1.1-4.2Z" fill="#f8fafc" opacity="0.95" />
      <path d="m20.5 11.7 3.3-4.2 3.4 4.2 4.4-2.2 1.8 5.1H14.3l1.8-5.1 4.4 2.2Z" fill="#facc15" opacity="0.95" />
    </svg>
  )
}
