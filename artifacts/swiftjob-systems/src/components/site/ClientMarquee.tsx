/**
 * ClientMarquee — continuously scrolling strip of client wordmarks.
 *
 * TRUST NOTE: These entries are placeholders styled as text wordmarks.
 * Replace the `CLIENTS` array with real client names (or drop logo image
 * URLs into `logo`) before marketing this as an endorsement. Never display
 * logos of companies that have not actually been served.
 */

export interface ClientEntry {
  name: string;
  /** Optional logo asset path; when omitted a styled text wordmark renders. */
  logo?: string;
}

const CLIENTS: ClientEntry[] = [
  { name: "NovaCare Health" },
  { name: "BrightCart" },
  { name: "FinEdge Capital" },
  { name: "Helix Telecom" },
  { name: "Orbit Logistics" },
  { name: "Crestline Insurance" },
  { name: "Vantage Learning" },
  { name: "Summit SaaS" },
  { name: "Atlas Travel Group" },
  { name: "Meridian Retail Co." },
];

export function ClientMarquee() {
  // Track is duplicated once so the -50% translate loops seamlessly.
  const row = [...CLIENTS, ...CLIENTS];
  return (
    <section className="client-marquee" aria-label="Companies we have staffed">
      <div className="client-marquee-inner">
        <span className="client-marquee-label">
          Trusted by teams we've staffed
        </span>
        <div className="client-marquee-viewport">
          <div className="client-marquee-track">
            {row.map((client, i) => (
              <span
                className="client-mark"
                key={`${client.name}-${i}`}
                aria-hidden={i >= CLIENTS.length}
              >
                {client.logo ? (
                  <img src={client.logo} alt="" loading="lazy" />
                ) : (
                  client.name
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
