import { Link } from "wouter";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SUPPORT_EMAIL } from "@/lib/contact";

function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <SiteLayout title={`${title} — SwiftJob`}>
      <div className="legal-shell">
        <div className="container legal-container">
          <div className="job-breadcrumb">
            <Link href="/">SwiftJob</Link>
            <span>/</span>
            <span>{title}</span>
          </div>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
          {children}
          <p className="legal-contact">
            Questions about this page? Email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and a real
            person will respond.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="legal-h2">{children}</h2>;
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" updated="August 2026">
      <p className="legal-p">
        SwiftJob is a remote-first staffing and business process outsourcing
        (BPO) company. We help businesses build remote teams, and we help
        candidates find remote work. This policy explains what information we
        collect when you use swiftjob.payservice.top, why we collect it, and the
        choices you have.
      </p>

      <H2>What we collect</H2>
      <ul className="legal-ul">
        <li>
          <strong>Application details</strong> you submit: name, email address,
          phone number, location and time zone, résumé/CV file, experience,
          education, expected salary, cover letter, and links you choose to
          share (LinkedIn, portfolio).
        </li>
        <li>
          <strong>Candidate portal activity:</strong> the status of your
          applications, notes our recruitment team writes about your
          application, and optional skills-check results.
        </li>
        <li>
          <strong>Skills-check technical data (optional stage):</strong> if you
          complete the setup checks, we store an estimate of your internet
          speed, your typing speed and accuracy for one short passage, basic
          browser-reported details (CPU core count, approximate device memory,
          screen size, time zone), and — only if you choose to download and run
          it — the output of the one-time SwiftJob System Checker tool
          (operating system, processor model, RAM, free disk space). The checker
          runs once, reports once, and then stops working.
        </li>
        <li>
          <strong>Referral pages:</strong> when you open a private referral
          briefing, we record that the page was viewed and on what type of
          device so the referring person and our team know the link reached you.
        </li>
        <li>
          <strong>Essential service data:</strong> standard server logs used to
          keep the site secure and working.
        </li>
      </ul>

      <H2>What we never do</H2>
      <ul className="legal-ul">
        <li>We never charge you anything to apply, interview, or start.</li>
        <li>
          We never sell your personal information to anyone, ever. Your details
          are shared only with the client company considering you for a role,
          and only at the relevant stage of hiring.
        </li>
        <li>
          We do not install software on your computer. The optional System
          Checker is a small script you choose to download; you can read exactly
          what it collects in the section above, and it stops working after one
          run.
        </li>
      </ul>

      <H2>Why we process your information</H2>
      <p className="legal-p">
        To evaluate your application, contact you about roles you applied or
        were referred for, operate your candidate portal, meet our legal and
        payroll obligations when you are hired, and improve the fairness and
        quality of our screening. Our lawful basis is your consent (submitting
        an application) and our legitimate interest in running a staffing
        service.
      </p>

      <H2>How long we keep it</H2>
      <p className="legal-p">
        Application details are kept while a role is open and for up to 24
        months afterwards so we can consider you for future remote positions,
        unless you ask us sooner to delete them. You can request deletion at any
        time by emailing <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        .
      </p>

      <H2>Your rights</H2>
      <p className="legal-p">
        You may ask for a copy of your data, correction of anything inaccurate,
        deletion of your data, or withdrawal of consent at any time. Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> — no forms, no
        hoops. If you are in the EU/UK, you also have the right to complain to
        your local data protection authority.
      </p>

      <H2>Security</H2>
      <p className="legal-p">
        Résumés are stored in access-controlled cloud storage, sign-in links are
        single-use and expire in 15 minutes, candidate sessions are encrypted in
        transit, and administrative actions on your data are logged.
      </p>
    </LegalShell>
  );
}

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" updated="August 2026">
      <p className="legal-p">
        These terms govern your use of swiftjob.payservice.top — including
        browsing roles, applying, being referred, completing skills checks, and
        using the candidate portal.
      </p>

      <H2>1. Eligibility</H2>
      <p className="legal-p">
        You must be legally able to work the hours the role requires and be at
        least 18 years old to apply. All current roles are fully remote; you are
        responsible for having a suitable computer and internet connection,
        which our optional setup checks help confirm.
      </p>

      <H2>2. Applications are free — always</H2>
      <p className="legal-p">
        SwiftJob never charges candidates any fee at any stage: not to apply,
        not for training, not for equipment "processing", not for anything.
        Anyone asking you to pay in our name is defrauding you — please report
        it to us immediately.
      </p>

      <H2>3. Honest applications</H2>
      <p className="legal-p">
        You agree the information you submit is accurate and yours. Skills-check
        results are one input our team considers; submitting false information,
        or having someone else complete your checks, means we must withdraw any
        offer.
      </p>

      <H2>4. Offers and employment</H2>
      <p className="legal-p">
        An application, referral, or shortlisting is not a guarantee of work.
        Employment (or contracting) begins only when you and the relevant party
        sign written documents. Pay rate, schedule, and conditions are stated in
        those documents before you commit to anything.
      </p>

      <H2>5. Private briefings and referral links</H2>
      <p className="legal-p">
        Referral briefing pages and any personal links are intended solely for
        the person they were sent to. Do not share them publicly. We may expire
        links that are posted publicly or abused.
      </p>

      <H2>6. Acceptable use</H2>
      <p className="legal-p">
        Don't attempt to break into, overload, scrape, or interfere with the
        service; don't misrepresent who you are; don't use automated tools to
        mass-apply. We may suspend access for abuse.
      </p>

      <H2>7. No warranty, limited liability</H2>
      <p className="legal-p">
        The service is provided "as is". To the maximum extent permitted by law,
        SwiftJob is not liable for indirect or consequential losses arising from
        use of this website. Nothing here limits liability that cannot be
        limited by law.
      </p>

      <H2>8. Changes</H2>
      <p className="legal-p">
        We may update these terms as the service evolves; the date above shows
        the current version. Material changes affecting active applicants will
        be communicated by email.
      </p>
    </LegalShell>
  );
}
