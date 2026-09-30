/** Abstract geometric marks only. No figures, no crescent clip art. One stroke, one weight. */
type P = { className?: string; size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const, "aria-hidden": true });

export const Star8 = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="5" width="14" height="14" />
    <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);
export const Ripple = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="12" r="5.5" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);
export const Vesica = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="12" r="6" />
    <circle cx="15" cy="12" r="6" />
  </svg>
);
export const Niche = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 21V10a6 6 0 0 1 12 0v11" />
    <path d="M9.5 21v-9.5a2.5 2.5 0 0 1 5 0V21" />
  </svg>
);
export const Chevron = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}><path d="M9 5l7 7-7 7" /></svg>
);
export const Check = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const Wordmark = ({ className, size = 26 }: P) => (
  <svg {...base(size)} className={className} strokeWidth={1.6}>
    <path d="M12.00 2.40 L14.81 5.21 L18.79 5.21 L18.79 9.19 L21.60 12.00 L18.79 14.81 L18.79 18.79 L14.81 18.79 L12.00 21.60 L9.19 18.79 L5.21 18.79 L5.21 14.81 L2.40 12.00 L5.21 9.19 L5.21 5.21 L9.19 5.21 Z" />
  </svg>
);
