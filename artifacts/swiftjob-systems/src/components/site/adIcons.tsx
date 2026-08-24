interface IconProps {
  size?: number;
}

/**
 * Custom icon set — 24px grid, 1.8px stroke, round caps/joins.
 * Drawn by hand for consistent optical weight across the ad widgets.
 */
export function WrenchIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.2 3.6a4.5 4.5 0 0 1 6.2 6.2l-4.1 4.1-2.1-2.1-1.5 1.5 2.1 2.1-4.1 4.1a4.5 4.5 0 0 1-6.2-6.2l2.6-2.6 2.1 2.1 1.5-1.5-2.1-2.1 2.6-2.6z" />
      <path d="M20.4 3.6l.6.6" />
    </svg>
  );
}

export function GradCapIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5z" />
      <path d="M6.5 11.8v4.2c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2" />
      <path d="M21.5 9.5v4.8" />
    </svg>
  );
}

export function MonitorPlayIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <path d="M10 12.5v-3.4l3 1.7-3 1.7z" fill="currentColor" stroke="none" />
      <path d="M9.5 20.5h5" />
    </svg>
  );
}

export function SparkIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5 13.9 9 19.5 11l-5.6 2L12 18.5 10.1 13 4.5 11l5.6-2z" />
      <path d="M18.5 16.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
    </svg>
  );
}
