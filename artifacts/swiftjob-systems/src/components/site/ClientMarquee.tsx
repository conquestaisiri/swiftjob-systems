export interface ClientEntry {
  name: string;
  logo?: string;
}

// Inline SVG wordmarks — each is a self-contained 140×36 logo.
// Replace any entry with a real client name + logo path when available.
// To use a real logo: { name: "Acme Corp", logo: "/logos/acme.svg" }

function Logo({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <span className="client-mark-logo" aria-label={name} title={name}>
      {children}
      <span className="client-mark-text">{name}</span>
    </span>
  );
}

const LOGOS: React.ReactNode[] = [
  // 1 — NovaCare Health — medical cross
  <Logo key="novacare" name="NovaCare Health">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle
        cx="14"
        cy="14"
        r="13"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.9"
      />
      <path
        d="M14 8v12M8 14h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  </Logo>,
  // 2 — BrightCart — cart
  <Logo key="brightcart" name="BrightCart">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M5 7h3l2.5 11h10l2-8H9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="22" r="1.7" fill="currentColor" />
      <circle cx="19" cy="22" r="1.7" fill="currentColor" />
    </svg>
  </Logo>,
  // 3 — FinEdge Capital — bar chart trending up
  <Logo key="finedge" name="FinEdge Capital">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect
        x="6"
        y="15"
        width="4"
        height="7"
        rx="1"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="11.5"
        y="11"
        width="4"
        height="11"
        rx="1"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="17"
        y="7"
        width="4"
        height="15"
        rx="1"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        d="M5 8l6-3 5 4 6-5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  </Logo>,
  // 4 — Helix Telecom — signal waves
  <Logo key="helix" name="Helix Telecom">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M7 14c2.5-5 6-7 7-7s4.5 2 7 7c-2.5 5-6 7-7 7s-4.5-2-7-7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="2.2" fill="currentColor" opacity="0.9" />
      <path
        d="M3 14c1.2-2.5 2.8-4 4.2-4.8M20.8 9.2C22.2 10 23.8 11.5 25 14"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  </Logo>,
  // 5 — Orbit Logistics — orbit rings
  <Logo key="orbit" name="Orbit Logistics">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <ellipse
        cx="14"
        cy="14"
        rx="9"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <ellipse
        cx="14"
        cy="14"
        rx="5"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.65"
      />
      <circle cx="14" cy="14" r="2.3" fill="currentColor" />
    </svg>
  </Logo>,
  // 6 — Crestline Insurance — shield
  <Logo key="crestline" name="Crestline Insurance">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 5l8 4v7c0 4.2-2.6 7.5-8 9-5.4-1.5-8-4.8-8-9V9l8-4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 14l3 3 5-6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </Logo>,
  // 7 — Vantage Learning — graduation cap
  <Logo key="vantage" name="Vantage Learning">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 6l10 5-10 5L4 11 14 6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 14.5v3c0 1.2 3.1 2.5 7 2.5s7-1.3 7-2.5v-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M24 11v5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="17.5" r="1.3" fill="currentColor" />
    </svg>
  </Logo>,
  // 8 — Summit SaaS — mountain
  <Logo key="summit" name="Summit SaaS">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M4 20l7-10 4 5 4-7 5 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20h20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="20.5" cy="7" r="1.6" fill="currentColor" opacity="0.7" />
    </svg>
  </Logo>,
  // 9 — Atlas Travel Group — globe
  <Logo key="atlas" name="Atlas Travel Group">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.3" />
      <ellipse
        cx="14"
        cy="14"
        rx="4.5"
        ry="9"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.7"
      />
      <path
        d="M5.5 14h17M7 10h14M7 18h14"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
        strokeLinecap="round"
      />
    </svg>
  </Logo>,
  // 10 — Meridian Retail — shopping bag
  <Logo key="meridian" name="Meridian Retail Co.">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M8 9h12l-1.5 11H9.5L8 9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M11 9V7a3 3 0 016 0v2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  </Logo>,
];

export function ClientMarquee() {
  const row = [...LOGOS, ...LOGOS];
  return (
    <section className="client-marquee" aria-label="Companies we have staffed">
      <div className="client-marquee-inner">
        <span className="client-marquee-label">
          Trusted by teams we've staffed
        </span>
        <div className="client-marquee-viewport">
          <div className="client-marquee-track">
            {row.map((logo, i) => (
              <span
                key={i}
                className="client-mark"
                aria-hidden={i >= LOGOS.length}
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
