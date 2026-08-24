import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MapPin,
  Briefcase,
  Users,
  Clock,
  DollarSign,
  Calendar,
  ArrowUpRight,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { fetchJobBySlug } from "@/lib/jobsApi";
import { fetchPublicStats } from "@/lib/campaignApi";
import type { Job } from "@/data/jobs";
import { parseDateOnly } from "@/lib/utils";

const TIMEZONES = [
  "UTC-12:00",
  "UTC-11:00",
  "UTC-10:00 (Hawaii)",
  "UTC-08:00 (Pacific Time)",
  "UTC-07:00 (Mountain Time)",
  "UTC-06:00 (Central Time)",
  "UTC-05:00 (Eastern Time)",
  "UTC-04:00 (Atlantic Time)",
  "UTC-03:00 (Buenos Aires)",
  "UTC-02:00",
  "UTC+00:00 (London / GMT)",
  "UTC+01:00 (Central Europe)",
  "UTC+02:00 (Eastern Europe)",
  "UTC+03:00 (Moscow / Riyadh)",
  "UTC+04:00 (Dubai)",
  "UTC+05:00 (Karachi)",
  "UTC+05:30 (India)",
  "UTC+06:00 (Dhaka)",
  "UTC+07:00 (Bangkok)",
  "UTC+08:00 (Singapore / HKT)",
  "UTC+09:00 (Tokyo)",
  "UTC+10:00 (Sydney)",
  "UTC+11:00",
  "UTC+12:00 (Auckland)",
];

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Costa Rica",
  "Croatia",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Ethiopia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Guatemala",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Panama",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Singapore",
  "Slovakia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Tunisia",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Zimbabwe",
];

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  timezone: string;
  linkedinUrl: string;
  portfolioUrl: string;
  yearsExperience: string;
  education: string;
  englishProficiency: string;
  noticePeriod: string;
  expectedSalary: string;
  earliestStartDate: string;
  skills: string;
  relevantExperience: string;
  coverLetter: string;
}

const INITIAL_FORM: FormData = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  timezone: "",
  linkedinUrl: "",
  portfolioUrl: "",
  yearsExperience: "",
  education: "",
  englishProficiency: "",
  noticePeriod: "",
  expectedSalary: "",
  earliestStartDate: "",
  skills: "",
  relevantExperience: "",
  coverLetter: "",
};

export function JobPage() {
  const [location, setLocation] = useLocation();
  const slug = location.replace("/careers/", "").replace(/\/$/, "");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<FormData & { resume: string }>>(
    {},
  );
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "error"
  >("idle");
  const [serverError, setServerError] = useState("");
  const [countriesDisplay, setCountriesDisplay] = useState("28");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setJob(null);
    fetchJobBySlug(slug)
      .then((j) => {
        if (!cancelled) setJob(j);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "We could not load this position right now. Please try again shortly.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Admin-editable stat copy (Settings → "Countries hired from" number).
    fetchPublicStats().then((stats) => {
      if (!cancelled && stats?.countriesDisplay) {
        setCountriesDisplay(stats.countriesDisplay);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <SiteLayout title="Loading — SwiftJob">
        <div className="not-found-shell">
          <div
            className="container"
            style={{ textAlign: "center", padding: "120px 0" }}
          >
            <Loader2
              size={40}
              className="spin"
              style={{ margin: "0 auto 20px" }}
            />
            <p style={{ color: "var(--slate-ink)" }}>Loading position…</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!job) {
    return (
      <SiteLayout title="Position Not Found — SwiftJob">
        <div className="not-found-shell">
          <div
            className="container"
            style={{ textAlign: "center", padding: "120px 0" }}
          >
            <h1 style={{ fontSize: "3rem", marginBottom: "16px" }}>
              Position not found
            </h1>
            <p style={{ color: "var(--slate-ink)", marginBottom: "32px" }}>
              {loadError ||
                "This role may have been filled or the link may be incorrect."}
            </p>
            <Link href="/careers" className="button button-blue">
              <ArrowLeft size={16} /> View all positions
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const set =
    (field: keyof FormData) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      if (errors[field])
        setErrors((prev) => {
          const n = { ...prev };
          delete n[field];
          return n;
        });
    };

  const validate = (): boolean => {
    const newErrors: Partial<FormData & { resume: string }> = {};
    const required: (keyof FormData)[] = [
      "fullName",
      "email",
      "phone",
      "country",
      "city",
      "timezone",
      "yearsExperience",
      "education",
      "englishProficiency",
      "noticePeriod",
      "expectedSalary",
      "earliestStartDate",
      "skills",
      "relevantExperience",
      "coverLetter",
    ];
    for (const field of required) {
      if (!form[field].trim()) newErrors[field] = "This field is required.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!resumeFile) newErrors.resume = "Please upload your CV or resume.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      const firstError = document.querySelector(".field-error");
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitState("submitting");
    setServerError("");

    const data = new FormData();
    data.append("position", job.title);
    (Object.entries(form) as [string, string][]).forEach(([k, v]) =>
      data.append(k, v),
    );
    const campaignSlug =
      new URLSearchParams(window.location.search).get("campaign") ?? "";
    if (campaignSlug) data.append("campaignSlug", campaignSlug);
    if (resumeFile) data.append("resume", resumeFile);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(
          json.error ?? "An unexpected error occurred. Please try again.",
        );
        setSubmitState("error");
        return;
      }
      const params = new URLSearchParams({
        id: json.applicationId ?? "",
        position: job.title,
        job: job.slug,
        email: form.email.trim(),
      });
      if (json.referenceCode) params.set("ref", json.referenceCode);
      const campaignSlug =
        new URLSearchParams(window.location.search).get("campaign") ?? "";
      if (campaignSlug) params.set("campaign", campaignSlug);
      setLocation(`/careers/apply/success?${params.toString()}`);
    } catch {
      setServerError(
        "Unable to connect. Please check your internet connection and try again.",
      );
      setSubmitState("error");
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <SiteLayout
      title={`${job.title} — Careers at SwiftJob`}
      description={job.summary}
    >
      {/* Breadcrumb */}
      <div className="job-breadcrumb">
        <div className="container">
          <Link href="/">Home</Link>
          <ChevronRight size={14} />
          <Link href="/careers">Careers</Link>
          <ChevronRight size={14} />
          <span>{job.title}</span>
        </div>
      </div>

      {/* Job Header */}
      <div className="job-header section-dark">
        <div className="container">
          <div className="job-header-inner">
            <div>
              <span className="job-header-dept">{job.department}</span>
              <h1 className="job-header-title">{job.title}</h1>
              <div className="job-header-meta">
                <span>
                  <MapPin size={14} /> {job.workArrangement}
                </span>
                <span>
                  <Briefcase size={14} /> {job.employmentType}
                </span>
                <span>
                  <Users size={14} /> {job.experienceLevel}
                </span>
                <span>
                  <Clock size={14} /> {job.experience}
                </span>
                <span>
                  <DollarSign size={14} /> {job.compensation}
                </span>
              </div>
            </div>
            <div className="job-header-actions">
              <button className="button button-mint" onClick={scrollToForm}>
                Apply now <ArrowUpRight size={17} />
              </button>
              <Link
                href="/careers"
                className="text-link light-link"
                style={{ fontSize: 12 }}
              >
                <ArrowLeft size={14} /> All positions
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="job-body">
        <div className="container">
          <div className="job-layout">
            {/* Left: Job Detail */}
            <div className="job-detail">
              {/* Overview */}
              <section className="job-section">
                <h2>About the role</h2>
                <p>{job.overview}</p>
              </section>

              {/* About SwiftJob */}
              <section className="job-section">
                <h2>About SwiftJob</h2>
                <p>
                  SwiftJob is a remote-first staffing and BPO partner. We find
                  and vet professionals for support, admin, technical, and
                  back-office roles, then manage the employment side—contracts,
                  payroll, compliance, and ongoing support—so our clients can
                  focus on the work.
                </p>
                <p>
                  We build remote teams across {countriesDisplay}+ countries and
                  serve businesses in technology, financial services,
                  e-commerce, healthcare, logistics, retail, and more. When you
                  work with us, we aim to be a partner for the long term—not
                  just a one-off placement.
                </p>
              </section>

              {/* Responsibilities */}
              <section className="job-section">
                <h2>Responsibilities</h2>
                <ul className="job-list">
                  {job.responsibilities.map((r, i) => (
                    <li key={i}>
                      <CheckCircle size={15} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Required Qualifications */}
              <section className="job-section">
                <h2>Required qualifications</h2>
                <ul className="job-list">
                  {job.requiredQualifications.map((q, i) => (
                    <li key={i}>
                      <CheckCircle size={15} />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Preferred Qualifications */}
              <section className="job-section">
                <h2>Preferred qualifications</h2>
                <ul className="job-list job-list-preferred">
                  {job.preferredQualifications.map((q, i) => (
                    <li key={i}>
                      <CheckCircle size={15} />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Skills */}
              <section className="job-section">
                <h2>Key skills</h2>
                <div className="job-skills-grid">
                  {job.skills.map((s) => (
                    <span key={s} className="job-skill-tag">
                      {s}
                    </span>
                  ))}
                </div>
              </section>

              {/* Software & Tools */}
              <section className="job-section">
                <h2>Software & tools</h2>
                <div className="job-skills-grid">
                  {job.softwareTools.map((t) => (
                    <span key={t} className="job-skill-tag job-skill-tool">
                      {t}
                    </span>
                  ))}
                </div>
              </section>

              {/* Benefits */}
              <section className="job-section">
                <h2>What we offer</h2>
                <ul className="job-list">
                  {job.benefits.map((b, i) => (
                    <li key={i}>
                      <CheckCircle size={15} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Working Hours */}
              <section className="job-section">
                <h2>Working hours</h2>
                <p>{job.workingHours}</p>
              </section>

              {/* Employment & Compensation */}
              <section className="job-section">
                <h2>Employment details</h2>
                <div className="job-details-grid">
                  <div className="job-detail-item">
                    <span>Employment type</span>
                    <strong>{job.employmentType}</strong>
                  </div>
                  <div className="job-detail-item">
                    <span>Work arrangement</span>
                    <strong>{job.workArrangement}</strong>
                  </div>
                  <div className="job-detail-item">
                    <span>Experience required</span>
                    <strong>{job.experience}</strong>
                  </div>
                  <div className="job-detail-item">
                    <span>Compensation</span>
                    <strong>{job.compensation}</strong>
                  </div>
                </div>
              </section>

              {/* Hiring Process */}
              <section className="job-section">
                <h2>Our hiring process</h2>
                <div className="hiring-steps">
                  {job.hiringProcess.map((step, i) => (
                    <div key={i} className="hiring-step">
                      <span className="hiring-step-num">0{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Equal Opportunity */}
              <section className="job-section job-section-eoe">
                <h2>Equal opportunity</h2>
                <p>
                  SwiftJob is an equal opportunity employer. We celebrate
                  diversity and are committed to creating an inclusive
                  environment for all employees and contractors. All hiring
                  decisions are made on the basis of qualifications, merit, and
                  business needs. We do not discriminate on the basis of race,
                  colour, religion, gender identity, sexual orientation,
                  national origin, disability, age, or any other characteristic
                  protected by applicable law.
                </p>
              </section>
            </div>

            {/* Right: Sticky Sidebar */}
            <aside className="job-sidebar">
              <div className="job-sidebar-card">
                <div className="sidebar-dept">{job.department}</div>
                <h3 className="sidebar-title">{job.title}</h3>
                <div className="sidebar-meta">
                  <div>
                    <MapPin size={13} />
                    <span>{job.workArrangement}</span>
                  </div>
                  <div>
                    <Briefcase size={13} />
                    <span>{job.employmentType}</span>
                  </div>
                  <div>
                    <Users size={13} />
                    <span>{job.experienceLevel}</span>
                  </div>
                  <div>
                    <DollarSign size={13} />
                    <span>{job.compensation}</span>
                  </div>
                  <div>
                    <Calendar size={13} />
                    <span>
                      Posted{" "}
                      {parseDateOnly(job.postedDate).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                </div>
                <button
                  className="button button-blue sidebar-apply-btn"
                  onClick={scrollToForm}
                >
                  Apply for this role <ArrowUpRight size={15} />
                </button>
                <Link href="/careers" className="sidebar-back">
                  <ArrowLeft size={13} /> All open positions
                </Link>
              </div>
            </aside>
          </div>

          {/* Application Form */}
          <div ref={formRef} className="application-form-section" id="apply">
            <div className="application-form-header">
              <div className="section-kicker" style={{ marginBottom: 12 }}>
                APPLY FOR THIS POSITION
              </div>
              <h2>Submit your application</h2>
              <p>
                Complete the form below to apply for the{" "}
                <strong>{job.title}</strong> role. All fields marked with{" "}
                <span style={{ color: "#c43b3b" }}>*</span> are required.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="application-form"
            >
              {/* Personal Information */}
              <div className="form-section-title">Personal information</div>
              <div className="app-form-grid">
                <div className="app-field">
                  <label>
                    Full name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={set("fullName")}
                    placeholder="Your full name"
                    className={errors.fullName ? "has-error" : ""}
                  />
                  {errors.fullName && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.fullName}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Email address <span className="req">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="you@example.com"
                    className={errors.email ? "has-error" : ""}
                  />
                  {errors.email && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.email}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Phone number <span className="req">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="+1 555 000 0000"
                    className={errors.phone ? "has-error" : ""}
                  />
                  {errors.phone && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.phone}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Country <span className="req">*</span>
                  </label>
                  <select
                    value={form.country}
                    onChange={set("country")}
                    className={errors.country ? "has-error" : ""}
                  >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {errors.country && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.country}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    City <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={set("city")}
                    placeholder="Your city"
                    className={errors.city ? "has-error" : ""}
                  />
                  {errors.city && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.city}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Time zone <span className="req">*</span>
                  </label>
                  <select
                    value={form.timezone}
                    onChange={set("timezone")}
                    className={errors.timezone ? "has-error" : ""}
                  >
                    <option value="">Select your time zone</option>
                    {TIMEZONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {errors.timezone && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.timezone}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    LinkedIn profile <span className="opt">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.linkedinUrl}
                    onChange={set("linkedinUrl")}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                </div>
                <div className="app-field">
                  <label>
                    Portfolio or website <span className="opt">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={form.portfolioUrl}
                    onChange={set("portfolioUrl")}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </div>

              {/* Position pre-filled */}
              <div className="form-section-title">Position details</div>
              <div className="app-form-grid">
                <div className="app-field">
                  <label>Position applying for</label>
                  <input
                    type="text"
                    value={job.title}
                    readOnly
                    className="readonly-field"
                  />
                </div>
                <div className="app-field">
                  <label>
                    Years of relevant experience <span className="req">*</span>
                  </label>
                  <select
                    value={form.yearsExperience}
                    onChange={set("yearsExperience")}
                    className={errors.yearsExperience ? "has-error" : ""}
                  >
                    <option value="">Select</option>
                    <option>Less than 1 year</option>
                    <option>1–2 years</option>
                    <option>2–3 years</option>
                    <option>3–5 years</option>
                    <option>5–8 years</option>
                    <option>8–10 years</option>
                    <option>10+ years</option>
                  </select>
                  {errors.yearsExperience && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.yearsExperience}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Highest education level <span className="req">*</span>
                  </label>
                  <select
                    value={form.education}
                    onChange={set("education")}
                    className={errors.education ? "has-error" : ""}
                  >
                    <option value="">Select</option>
                    <option>High school diploma or equivalent</option>
                    <option>Associate degree or diploma</option>
                    <option>Bachelor's degree</option>
                    <option>Master's degree</option>
                    <option>Doctoral degree</option>
                    <option>Professional certification</option>
                    <option>Vocational / trade qualification</option>
                    <option>Other</option>
                  </select>
                  {errors.education && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.education}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    English proficiency <span className="req">*</span>
                  </label>
                  <select
                    value={form.englishProficiency}
                    onChange={set("englishProficiency")}
                    className={errors.englishProficiency ? "has-error" : ""}
                  >
                    <option value="">Select</option>
                    <option>Native / Bilingual</option>
                    <option>Full professional proficiency (C1–C2)</option>
                    <option>Professional working proficiency (B2)</option>
                    <option>Limited working proficiency (B1)</option>
                    <option>Elementary proficiency (A1–A2)</option>
                  </select>
                  {errors.englishProficiency && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.englishProficiency}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Notice period <span className="req">*</span>
                  </label>
                  <select
                    value={form.noticePeriod}
                    onChange={set("noticePeriod")}
                    className={errors.noticePeriod ? "has-error" : ""}
                  >
                    <option value="">Select</option>
                    <option>Immediately available</option>
                    <option>1 week</option>
                    <option>2 weeks</option>
                    <option>1 month</option>
                    <option>2 months</option>
                    <option>3 months or more</option>
                  </select>
                  {errors.noticePeriod && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.noticePeriod}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Expected monthly salary (USD) <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.expectedSalary}
                    onChange={set("expectedSalary")}
                    placeholder="e.g. $800–$1,000/month"
                    className={errors.expectedSalary ? "has-error" : ""}
                  />
                  {errors.expectedSalary && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.expectedSalary}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Earliest start date <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.earliestStartDate}
                    onChange={set("earliestStartDate")}
                    className={errors.earliestStartDate ? "has-error" : ""}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  {errors.earliestStartDate && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.earliestStartDate}
                    </span>
                  )}
                </div>
                <div className="app-field">
                  <label>
                    Key skills <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.skills}
                    onChange={set("skills")}
                    placeholder="e.g. Excel, CRM management, communication"
                    className={errors.skills ? "has-error" : ""}
                  />
                  {errors.skills && (
                    <span className="field-error">
                      <AlertCircle size={12} /> {errors.skills}
                    </span>
                  )}
                </div>
              </div>

              {/* Long-form fields */}
              <div className="form-section-title">Your background</div>
              <div className="app-field app-field-full">
                <label>
                  Relevant experience <span className="req">*</span>
                </label>
                <textarea
                  value={form.relevantExperience}
                  onChange={set("relevantExperience")}
                  rows={5}
                  placeholder="Briefly describe your most relevant experience for this role — specific roles, responsibilities, or achievements that demonstrate your fit."
                  className={errors.relevantExperience ? "has-error" : ""}
                />
                {errors.relevantExperience && (
                  <span className="field-error">
                    <AlertCircle size={12} /> {errors.relevantExperience}
                  </span>
                )}
              </div>
              <div className="app-field app-field-full">
                <label>
                  Cover letter <span className="req">*</span>
                </label>
                <textarea
                  value={form.coverLetter}
                  onChange={set("coverLetter")}
                  rows={6}
                  placeholder="Tell us why you are interested in this role and what you would bring to the team. A thoughtful, specific cover letter strengthens your application."
                  className={errors.coverLetter ? "has-error" : ""}
                />
                {errors.coverLetter && (
                  <span className="field-error">
                    <AlertCircle size={12} /> {errors.coverLetter}
                  </span>
                )}
              </div>

              {/* Resume Upload */}
              <div className="form-section-title">Resume / CV</div>
              <div className="app-field app-field-full">
                <label>
                  Upload your CV or resume <span className="req">*</span>
                </label>
                <div
                  className={`upload-drop-zone ${resumeFile ? "has-file" : ""} ${errors.resume ? "has-error" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                >
                  {resumeFile ? (
                    <div className="upload-file-info">
                      <Upload size={18} />
                      <span>{resumeFile.name}</span>
                      <button
                        type="button"
                        className="upload-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResumeFile(null);
                          if (fileInputRef.current)
                            fileInputRef.current.value = "";
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="upload-prompt">
                      <Upload size={22} />
                      <p>
                        <strong>Click to upload</strong> or drag and drop your
                        file here
                      </p>
                      <small>PDF, DOC, or DOCX · Max 10 MB</small>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {errors.resume && (
                  <span className="field-error">
                    <AlertCircle size={12} /> {errors.resume}
                  </span>
                )}
              </div>

              {serverError && (
                <div className="app-server-error">
                  <AlertCircle size={16} />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="app-submit-row">
                <button
                  type="submit"
                  className="button button-blue app-submit-btn"
                  disabled={submitState === "submitting"}
                >
                  {submitState === "submitting" ? (
                    <>
                      <Loader2 size={16} className="spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit application <ArrowUpRight size={16} />
                    </>
                  )}
                </button>
                <p className="app-privacy-note">
                  Your information is handled securely and used solely for
                  recruitment purposes. We do not share your data with third
                  parties without your consent.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </SiteLayout>
  );

  function handleFileSelect(file: File) {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        resume: "Only PDF, DOC, and DOCX files are accepted.",
      }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        resume: "File size must not exceed 10 MB.",
      }));
      return;
    }
    setResumeFile(file);
    setErrors((prev) => {
      const n = { ...prev };
      delete n.resume;
      return n;
    });
  }
}
