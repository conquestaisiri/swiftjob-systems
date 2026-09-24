const SUPPORTED_ROLES = [
  "Customer support",
  "Operations",
  "Administration",
  "Technical support",
  "Marketing",
  "Finance",
];

/** Factual capability strip; it does not imply unverified client endorsements. */
export function ClientMarquee() {
  const row = [...SUPPORTED_ROLES, ...SUPPORTED_ROLES];
  return (
    <section className="client-marquee" aria-label="Roles SwiftJob supports">
      <div className="client-marquee-inner">
        <span className="client-marquee-label">Roles we help teams fill</span>
        <div className="client-marquee-viewport">
          <div className="client-marquee-track">
            {row.map((role, i) => (
              <span
                key={`${role}-${i}`}
                className="client-mark"
                aria-hidden={i >= SUPPORTED_ROLES.length}
              >
                <span className="client-mark-logo" aria-label={role}>
                  <span className="client-mark-text">{role}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
