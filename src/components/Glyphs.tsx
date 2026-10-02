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

export const Calendar = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2" />
  </svg>
);
export const Book = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" />
    <path d="M12 6.5v13" />
  </svg>
);
export const CloudDown = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1-.5 9.5" />
    <path d="M12 11.5v7M9 15.75l3 3 3-3" />
  </svg>
);
export const CloudCheck = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1-.5 9.5" />
    <path d="M9 14.5l2.25 2.25L15.5 12.5" />
  </svg>
);
export const Search = ({ className, size = 20 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);
export const Bookmark = ({ className, size = 18, filled = false }: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}>
    <path d="M6.5 4h11v16.5L12 16.5l-5.5 4z" />
  </svg>
);
export const Horizon = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 15a6 6 0 0 1 12 0" />
    <path d="M3 15h18" />
    <path d="M7 19h10" />
  </svg>
);
/** One mark per need, shared by Home's topic rows and the Recitations tab. */
export const INTENT_GLYPH = { "daily-protection": Star8, pain: Ripple, "evil-eye": Vesica, learning: Niche } as const;
export const Dots = ({ className, size = 24 }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="6" cy="12" r="1.3" />
    <circle cx="12" cy="12" r="1.3" />
    <circle cx="18" cy="12" r="1.3" />
  </svg>
);
