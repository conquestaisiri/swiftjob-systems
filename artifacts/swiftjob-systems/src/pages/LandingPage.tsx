import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Globe2,
  Menu,
  PackageCheck,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { fetchJobs } from "@/lib/jobsApi";
import { ClientMarquee } from "@/components/site/ClientMarquee";
import { SiteFooter } from "@/components/site/SiteFooter";

const categories = [
  {
    title: "Customer Experience",
    copy: "Support agents, chat and email specialists, and success teams that keep your customers looked after across time zones.",
    image: "/wfh-call.svg",
    meta: "Support · Chat · Email · Voice",
  },
  {
    title: "Admin & Virtual Assistance",
    copy: "Virtual assistants, coordinators, and data specialists who keep schedules, inboxes, records, and day-to-day operations running smoothly.",
    image: "/work-professional-real.jpg",
    meta: "VA · Data Entry · Scheduling",
  },
  {
    title: "Tech, Data & Growth",
    copy: "IT support, developers, analysts, and marketing specialists — vetted professionals who plug straight into your tools and workflows.",
    image: "/work-team-real.jpg",
    meta: "IT Support · Data · Marketing",
  },
];

const steps = [
  [
    "01",
    "Tell us the role",
    "Share what the work involves, the hours and time zones, and what a great hire looks like.",
  ],
  [
    "02",
    "Meet a vetted shortlist",
    "We source, screen, and skills-check remote candidates, then share a focused shortlist with context on each person.",
  ],
  [
    "03",
    "Onboard and stay supported",
    "We handle contracts, payroll, and compliance — and stay close through onboarding and beyond.",
  ],
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jobs, setJobs] = useState<
    {
      slug: string;
      title: string;
      department?: string;
      workArrangement?: string;
    }[]
  >([]);
  const [formState, setFormState] = useState<
    "idle" | "busy" | "success" | "error"
  >("idle");
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    document.title = "SwiftJob | People for the work ahead";
    fetchJobs()
      .then((data) => setJobs(data.slice(0, 3)))
      .catch(() => setJobs([]));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Capture before awaiting — event.currentTarget is null after the await.
    const formEl = event.currentTarget;
    const data = new FormData(formEl);
    setFormState("busy");
    setFormMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.get("firstName"),
          email: data.get("email"),
          interest: data.get("interest"),
          message: data.get("message"),
        }),
      });
      if (!response.ok)
        throw new Error("We could not send your message. Please try again.");
      setFormState("success");
      setFormMessage("Thanks. We will be in touch shortly.");
      formEl.reset();
    } catch (error) {
      setFormState("error");
      setFormMessage(
        error instanceof Error
          ? error.message
          : "We could not send your message. Please try again.",
      );
    }
  };

  return (
    <div className="landing-v2">
      <header className="landing-v2-header">
        <div className="landing-v2-nav">
          <Link href="/" className="landing-v2-brand">
            <img src="/swiftjob-mark.svg" alt="SwiftJob" />
            <span>SwiftJob</span>
          </Link>
          <nav className="landing-v2-links" aria-label="Primary navigation">
            <a href="#work">What we do</a>
            <a href="#process">How it works</a>
            <Link href="/careers">Careers</Link>
            <a href="#contact">Contact</a>
          </nav>
          <div className="landing-v2-actions">
            <Link href="/careers" className="landing-v2-login">
              Candidate access <ArrowUpRight size={14} />
            </Link>
            <a href="#contact" className="landing-v2-button">
              Talk to SwiftJob <ArrowUpRight size={15} />
            </a>
          </div>
          <button
            className="landing-v2-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <div className="landing-v2-mobile">
            <a href="#work" onClick={() => setMobileOpen(false)}>
              What we do
            </a>
            <a href="#process" onClick={() => setMobileOpen(false)}>
              How it works
            </a>
            <Link href="/careers">Careers</Link>
            <a href="#contact" onClick={() => setMobileOpen(false)}>
              Contact
            </a>
            <a href="#contact" className="landing-v2-button">
              Talk to SwiftJob <ArrowUpRight size={15} />
            </a>
          </div>
        )}
      </header>

      <main>
        <section className="landing-v2-hero">
          <div className="landing-v2-hero-copy">
            <span className="landing-v2-eyebrow">
              <i /> Remote staffing, done properly
            </span>
            <h1>
              Good people.
              <br />
              <em>Good work.</em>
              <br />
              Better
              <br />
              matched.
            </h1>
            <p>
              SwiftJob is a remote-first staffing and BPO partner. We connect
              organizations with vetted professionals for customer support,
              admin, technical, and back-office roles — 100% remote, across time
              zones.
            </p>
            <div className="landing-v2-hero-actions">
              <a
                className="landing-v2-button landing-v2-button-dark"
                href="#contact"
              >
                Build your team <ArrowUpRight size={16} />
              </a>
              <Link href="/careers" className="landing-v2-text-link">
                Find a role <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="landing-v2-hero-art">
            <div className="landing-v2-art-label">
              People at work <span>01 / 04</span>
            </div>
            <figure className="landing-v2-photo landing-v2-photo-a">
              <img
                src="/wfh-desk.svg"
                alt="A professional working from a home desk"
              />
            </figure>
            <figure className="landing-v2-photo landing-v2-photo-b">
              <img
                src="/work-professional-real.jpg"
                alt="A remote professional on a video call"
              />
            </figure>
            <figure className="landing-v2-photo landing-v2-photo-c">
              <img
                src="/work-team-real.jpg"
                alt="A distributed team collaborating online"
              />
            </figure>
            <div className="landing-v2-art-card">
              <span>One partner</span>
              <strong>for every remote role.</strong>
              <small>100% Remote · Global talent</small>
            </div>
          </div>
        </section>

        <section className="landing-v2-section landing-v2-intro" id="about">
          <div className="landing-v2-section-label">01 / THE WORK</div>
          <div>
            <h2>Every organization has work that matters.</h2>
            <p>
              We help you staff it remotely. That might be a support team that
              covers your customers around the clock, an assistant keeping
              operations organized, or a specialist behind the scenes — sourced,
              vetted, and managed by us.
            </p>
            <a href="#process" className="landing-v2-text-link">
              How we help <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <ClientMarquee />

        <section className="landing-v2-section landing-v2-categories" id="work">
          <div className="landing-v2-section-heading">
            <div>
              <span className="landing-v2-eyebrow">
                <i /> Where we help
              </span>
              <h2>
                Different work.
                <br />
                <em>Same standard.</em>
              </h2>
            </div>
            <p>
              We do not force every role into the same mould. We take the time
              to understand the work, the working hours, and the people who will
              thrive in it — then match accordingly.
            </p>
          </div>
          <div className="landing-v2-category-grid">
            {categories.map((category) => (
              <article className="landing-v2-category" key={category.title}>
                <img src={category.image} alt="" />
                <div className="landing-v2-category-body">
                  <span>{category.meta}</span>
                  <h3>{category.title}</h3>
                  <p>{category.copy}</p>
                  <ArrowUpRight size={19} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-v2-split">
          <div className="landing-v2-split-image">
            <img
              src="/work-professional-real.jpg"
              alt="A diverse professional team collaborating"
            />
          </div>
          <div className="landing-v2-split-copy">
            <span className="landing-v2-eyebrow">
              <i /> For organizations
            </span>
            <h2>Hiring should feel clear, not like a second job.</h2>
            <p>
              We take the search, screening, paperwork, and people operations
              off your plate—so your team can stay focused on the work itself.
            </p>
            <ul>
              <li>
                <Check size={16} /> A brief built around the real role
              </li>
              <li>
                <Check size={16} /> A focused shortlist, not a stack of CVs
              </li>
              <li>
                <Check size={16} /> Support that continues after the start date
              </li>
            </ul>
            <a
              href="#contact"
              className="landing-v2-button landing-v2-button-dark"
            >
              Tell us what you need <ArrowUpRight size={16} />
            </a>
          </div>
        </section>

        <section className="landing-v2-section landing-v2-process" id="process">
          <div className="landing-v2-section-heading">
            <div>
              <span className="landing-v2-eyebrow">
                <i /> A better way to hire
              </span>
              <h2>
                Simple steps.
                <br />
                <em>Serious follow-through.</em>
              </h2>
            </div>
            <p>
              You always know what is happening, what we need from you, and what
              happens next.
            </p>
          </div>
          <div className="landing-v2-step-grid">
            {steps.map(([number, title, copy]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-v2-roles">
          <div>
            <span className="landing-v2-eyebrow">
              <i /> For professionals
            </span>
            <h2>Find work that fits your life and your skills.</h2>
            <p>
              Explore legitimate opportunities, understand the role before you
              apply, and keep track of your application from one place.
            </p>
            <Link
              href="/careers"
              className="landing-v2-button landing-v2-button-light"
            >
              Browse open roles <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="landing-v2-role-list">
            {(jobs.length
              ? jobs
              : [
                  {
                    slug: "careers",
                    department: "100% remote",
                    title: "Browse all open remote roles",
                  },
                ]
            ).map((job) => (
              <Link
                href={
                  job.slug === "careers" ? "/careers" : `/careers/${job.slug}`
                }
                className="landing-v2-role"
                key={job.slug}
              >
                <span>{job.department}</span>
                <strong>{job.title}</strong>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        </section>

        <section className="landing-v2-portal">
          <div className="landing-v2-section-heading">
            <div>
              <span className="landing-v2-eyebrow">
                <i /> For candidates
              </span>
              <h2>
                Your portal,
                <br />
                <em>step by step.</em>
              </h2>
            </div>
            <p>
              Everything happens from your email address — the one you use when
              you apply. Here is exactly how you get in, what you will see, and
              what you should have ready.
            </p>
          </div>
          <div className="landing-v2-portal-steps">
            <article>
              <span>1</span>
              <h3>Apply with your email</h3>
              <p>
                Submit your application on the role page. Use an email address
                you check every day — it becomes the key to your portal.
              </p>
            </article>
            <article>
              <span>2</span>
              <h3>Open the magic link</h3>
              <p>
                We send a secure sign-in link to that email (valid 15 minutes).
                One tap and you are in — no passwords to remember or reset.
              </p>
            </article>
            <article>
              <span>3</span>
              <h3>Complete your assessment</h3>
              <p>
                Most roles include a short skills check: a quick system check,
                then questions matched to the job. It takes about 5–10 minutes
                and auto-saves as you go.
              </p>
            </article>
            <article>
              <span>4</span>
              <h3>Track your application</h3>
              <p>
                Your portal shows your application status, assessment result,
                and updates from the team. Keep your application reference
                number — you will need it for questions.
              </p>
            </article>
          </div>
          <div className="landing-v2-portal-actions">
            <Link
              href="/login"
              className="landing-v2-button landing-v2-button-light"
            >
              Open candidate portal <ArrowUpRight size={16} />
            </Link>
            <span>
              Applied already? Check your inbox for the magic link, or use the
              referral link we emailed you.
            </span>
          </div>
        </section>

        <section className="landing-v2-contact" id="contact">
          <div className="landing-v2-contact-copy">
            <span className="landing-v2-eyebrow">
              <i /> Start a conversation
            </span>
            <h2>Tell us about the work.</h2>
            <p>
              Whether you are hiring one person or building a whole team, we
              will help you work out the next practical step.
            </p>
            <div className="landing-v2-contact-details">
              <span>
                <UsersRound size={16} /> Employers and hiring teams
              </span>
              <span>
                <BriefcaseBusiness size={16} /> Candidates and professionals
              </span>
            </div>
          </div>
          <form className="landing-v2-form" onSubmit={submit}>
            <label>
              Your name
              <input required name="firstName" placeholder="Your name" />
            </label>
            <label>
              Email address
              <input
                required
                type="email"
                name="email"
                placeholder="you@company.com"
              />
            </label>
            <label>
              What can we help with?
              <select name="interest" defaultValue="" required>
                <option value="" disabled>
                  Select one
                </option>
                <option>Hiring a team</option>
                <option>Filling a specific role</option>
                <option>Finding work</option>
                <option>Something else</option>
              </select>
            </label>
            <label>
              Briefly tell us more
              <textarea
                required
                name="message"
                rows={4}
                placeholder="A little context helps us route your enquiry well."
              />
            </label>
            {formMessage && (
              <p
                className={
                  formState === "error"
                    ? "landing-v2-form-error"
                    : "landing-v2-form-success"
                }
              >
                {formMessage}
              </p>
            )}
            <button
              className="landing-v2-button landing-v2-button-light"
              disabled={formState === "busy"}
            >
              {formState === "busy" ? "Sending…" : "Send enquiry"}{" "}
              <ArrowUpRight size={16} />
            </button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
