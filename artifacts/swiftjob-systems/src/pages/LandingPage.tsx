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
import { SiteFooter } from "@/components/site/SiteFooter";

const categories = [
  {
    title: "Operations & logistics",
    copy: "People who keep orders moving, sites organized, and customers looked after.",
    image: "/work-warehouse-real.jpg",
    meta: "Warehouse · Packing · Fulfilment",
  },
  {
    title: "Facilities & field work",
    copy: "Dependable hands for the work that happens on-site, in-person, and every day.",
    image: "/work-facilities-real.jpg",
    meta: "Cleaning · Maintenance · Retail",
  },
  {
    title: "Professional teams",
    copy: "Thoughtful specialists for the work that needs planning, judgment, and expertise.",
    image: "/work-team-real.jpg",
    meta: "Finance · Support · Administration",
  },
];

const steps = [
  [
    "01",
    "Start with the work",
    "Tell us what needs to get done, where it happens, and what good looks like.",
  ],
  [
    "02",
    "Meet the right people",
    "We search, screen, and share a focused shortlist with the context you need.",
  ],
  [
    "03",
    "Keep work moving",
    "We stay close through onboarding, payroll, compliance, and the working relationship.",
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
    const data = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
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
              <i /> A workforce partner for real work
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
              SwiftJob connects organizations with capable people for
              professional, operational, technical, and hands-on roles.
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
                src="/work-office.jpg"
                alt="A team collaborating around a table"
              />
            </figure>
            <figure className="landing-v2-photo landing-v2-photo-b">
              <img
                src="/work-warehouse.jpg"
                alt="A warehouse prepared for fulfilment work"
              />
            </figure>
            <figure className="landing-v2-photo landing-v2-photo-c">
              <img
                src="/work-facilities.jpg"
                alt="A facilities worker completing on-site work"
              />
            </figure>
            <div className="landing-v2-art-card">
              <span>One partner</span>
              <strong>for every kind of work.</strong>
              <small>Remote · Hybrid · On-site</small>
            </div>
          </div>
        </section>

        <section className="landing-v2-proof">
          <div>
            <Globe2 size={17} />
            <span>Global reach</span>
            <strong>28+ countries</strong>
          </div>
          <div>
            <ShieldCheck size={17} />
            <span>Clear process</span>
            <strong>Vetted people, honest updates</strong>
          </div>
          <div>
            <PackageCheck size={17} />
            <span>Practical support</span>
            <strong>From first brief to first day</strong>
          </div>
        </section>

        <section className="landing-v2-section landing-v2-intro" id="about">
          <div className="landing-v2-section-label">01 / THE WORK</div>
          <div>
            <h2>Every organization has work that matters.</h2>
            <p>
              We help you find the people who can do it well. That might be
              someone keeping a warehouse moving, a team member supporting
              customers, a technician on-site, or a specialist working behind
              the scenes.
            </p>
            <a href="#process" className="landing-v2-text-link">
              How we help <ArrowRight size={16} />
            </a>
          </div>
        </section>

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
              to understand the work, the environment, and the people who will
              thrive in it.
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
              : [{ slug: "careers", title: "Explore current opportunities" }]
            ).map((job) => (
              <Link
                href={
                  job.slug === "careers" ? "/careers" : `/careers/${job.slug}`
                }
                className="landing-v2-role"
                key={job.slug}
              >
                <span>{job.department || "Open opportunity"}</span>
                <strong>{job.title}</strong>
                <ArrowUpRight size={17} />
              </Link>
            ))}
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
              <select name="interest" defaultValue="">
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
