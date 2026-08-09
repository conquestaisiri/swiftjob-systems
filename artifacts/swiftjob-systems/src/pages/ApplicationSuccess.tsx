import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle, Mail, ArrowUpRight, ArrowLeft } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export function ApplicationSuccess() {
  const params = new URLSearchParams(window.location.search);
  const applicationId = params.get("id") ?? "";
  const position = params.get("position") ?? "the position";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const shortId = applicationId
    ? applicationId.split("-")[0].toUpperCase()
    : "—";

  return (
    <SiteLayout
      title="Application Received — SwiftJob"
      description="Thank you for applying to SwiftJob. Your application has been received."
    >
      <div className="success-shell">
        <div className="success-card reveal is-visible">
          <div className="success-icon-wrap">
            <CheckCircle size={44} strokeWidth={1.5} />
          </div>

          <div className="success-eyebrow">APPLICATION RECEIVED</div>
          <h1 className="success-heading">
            Thank you for applying
            <br />
            <span>to SwiftJob.</span>
          </h1>

          <p className="success-lead">
            We have received your application for <strong>{position}</strong>{" "}
            and it is now under review by our recruitment team.
          </p>

          <div className="success-ref-box">
            <span className="success-ref-label">
              Your Application Reference
            </span>
            <span className="success-ref-id">{shortId}</span>
          </div>

          <div className="success-what-next">
            <h2>What happens next?</h2>
            <div className="success-steps">
              {[
                [
                  "01",
                  "Application review",
                  "Our recruitment team carefully reviews every application we receive. This typically takes 3–5 business days.",
                ],
                [
                  "02",
                  "Initial screening",
                  "Shortlisted candidates are invited to complete a short video introduction or written task at their convenience.",
                ],
                [
                  "03",
                  "Workshop briefing",
                  "Candidates who progress are invited to a guided workshop with our recruitment team to complete their setup.",
                ],
                [
                  "04",
                  "Decision & offer",
                  "Successful candidates receive a formal offer and are guided through a structured onboarding process.",
                ],
              ].map(([num, title, copy]) => (
                <div className="success-step" key={num}>
                  <span className="success-step-num">{num}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="success-contact-box">
            <Mail size={18} />
            <div>
              <p>
                If you would like to help our team identify your application
                more quickly, you are welcome to send a brief note to our
                recruitment team — including your reference number and the
                position you applied for.
              </p>
              <a
                href="mailto:careers@swiftjob.payservice.top"
                className="success-email"
              >
                careers@swiftjob.payservice.top <ArrowUpRight size={14} />
              </a>
            </div>
          </div>

          <div className="success-actions">
            <Link href="/careers" className="button button-blue">
              <ArrowLeft size={16} /> View all positions
            </Link>
            <Link href="/" className="button button-dark">
              Return to homepage <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
