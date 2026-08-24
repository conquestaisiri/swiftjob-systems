import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  ArrowUpRight,
  ChevronDown,
  Users,
  SlidersHorizontal,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  EXPERIENCE_LEVELS,
  EMPLOYMENT_TYPES,
  WORK_ARRANGEMENTS,
  type Job,
} from "@/data/jobs";
import { fetchJobs } from "@/lib/jobsApi";
import { fetchPublicStats } from "@/lib/campaignApi";
import { parseDateOnly } from "@/lib/utils";
import { CAREERS_EMAIL } from "@/lib/contact";

const JOBS_PER_PAGE = 9;

function formatDate(iso: string) {
  // postedDate is date-only; parse at LOCAL midnight so timezones don't turn
  // "today" into "yesterday" (same treatment as the job detail sidebar).
  const d = parseDateOnly(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/careers/${job.slug}`}
      className="job-card"
      data-testid={`job-card-${job.slug}`}
    >
      <div className="job-card-header">
        <div>
          <span className="job-card-dept">{job.department}</span>
          <h3 className="job-card-title">{job.title}</h3>
        </div>
        <span className="job-card-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>

      <p className="job-card-summary">{job.summary}</p>

      <div className="job-card-tags">
        <span className="job-tag job-tag-remote">
          <MapPin size={11} /> {job.workArrangement}
        </span>
        <span className="job-tag">
          <Briefcase size={11} /> {job.employmentType}
        </span>
        <span className="job-tag">
          <Users size={11} /> {job.experienceLevel}
        </span>
        <span className="job-tag">
          <Clock size={11} /> {job.experience}
        </span>
      </div>

      <div className="job-card-footer">
        <span className="job-card-comp">{job.compensation}</span>
        <span className="job-card-date">
          Posted {formatDate(job.postedDate)}
        </span>
      </div>

      <div className="job-card-cta">
        View Position <ArrowUpRight size={14} />
      </div>
    </Link>
  );
}

export function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [countriesDisplay, setCountriesDisplay] = useState<string>("28");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetchJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "We could not load the positions right now. Please try again shortly.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Admin-editable stat copy (Settings → "Countries hired from" number).
    fetchPublicStats().then((stats) => {
      if (cancelled || !stats?.countriesDisplay) return;
      setCountriesDisplay(stats.countriesDisplay);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const departments = useMemo(
    () => [...new Set(jobs.map((j) => j.department))].sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const q = query.toLowerCase();
      if (
        q &&
        !job.title.toLowerCase().includes(q) &&
        !job.department.toLowerCase().includes(q) &&
        !job.summary.toLowerCase().includes(q)
      )
        return false;
      if (department && job.department !== department) return false;
      if (employmentType && job.employmentType !== employmentType) return false;
      if (experienceLevel && job.experienceLevel !== experienceLevel)
        return false;
      if (workArrangement && job.workArrangement !== workArrangement)
        return false;
      return true;
    });
  }, [
    query,
    department,
    employmentType,
    experienceLevel,
    workArrangement,
    jobs,
  ]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const clearFilters = () => {
    setQuery("");
    setDepartment("");
    setEmploymentType("");
    setExperienceLevel("");
    setWorkArrangement("");
    setVisibleCount(JOBS_PER_PAGE);
  };

  const hasActiveFilters =
    query || department || employmentType || experienceLevel || workArrangement;

  return (
    <SiteLayout
      title="Remote Careers — SwiftJob"
      description="Explore open remote positions at SwiftJob. 100% work-from-home roles across customer support, virtual assistance, data, IT, finance, and marketing — with real companies and fair pay."
    >
      {/* Hero */}
      <section className="careers-hero section-dark">
        <div className="container">
          <div
            className="section-kicker light-eyebrow reveal"
            style={{ marginBottom: "20px" }}
          >
            <span className="eyebrow-line" />
            OPEN POSITIONS
          </div>
          <h1 className="careers-hero-title reveal">
            Browse our
            <br />
            <em>remote roles.</em>
          </h1>
          <p className="careers-hero-sub reveal">
            Every position below is a real, open, 100% remote job with a clear
            description and a simple way to apply. Work from home on a laptop,
            with training and support from day one.
          </p>
          <div className="careers-hero-stats reveal">
            <span>
              <strong>{jobs.length}</strong> open positions
            </span>
            <span className="stat-sep">·</span>
            <span>
              <strong>100%</strong> remote
            </span>
            <span className="stat-sep">·</span>
            <span>
              <strong>{countriesDisplay}</strong> countries
            </span>
          </div>
        </div>
        <div
          className="careers-hero-people"
          aria-label="Remote professionals at work"
        >
          <figure>
            <img src="/work-office.jpg" alt="Remote professional working" />
          </figure>
          <figure>
            <img
              src="/work-professional-real.jpg"
              alt="Team member on a video call"
            />
          </figure>
          <figure>
            <img
              src="/work-team-real.jpg"
              alt="Distributed team collaborating online"
            />
          </figure>
          <span className="careers-hero-people-note">
            Remote roles.
            <br />
            <strong>One standard of care.</strong>
          </span>
        </div>
      </section>

      {/* Search + Filters */}
      <div className="careers-controls-bar">
        <div className="container">
          <div className="careers-search-row">
            <div className="careers-search-wrap">
              <Search size={17} className="search-icon" />
              <input
                type="search"
                placeholder="Search by title, department, or keyword…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(JOBS_PER_PAGE);
                }}
                className="careers-search"
                aria-label="Search positions"
              />
              {query && (
                <button
                  className="search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className={`filters-toggle ${filtersOpen ? "active" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={15} /> Filters
              {hasActiveFilters && <span className="filter-badge" />}
            </button>
          </div>

          {filtersOpen && (
            <div className="careers-filters">
              <div className="filter-group">
                <label>
                  Department
                  <ChevronDown size={13} />
                </label>
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setVisibleCount(JOBS_PER_PAGE);
                  }}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>
                  Employment type
                  <ChevronDown size={13} />
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => {
                    setEmploymentType(e.target.value);
                    setVisibleCount(JOBS_PER_PAGE);
                  }}
                >
                  <option value="">All types</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>
                  Experience level
                  <ChevronDown size={13} />
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => {
                    setExperienceLevel(e.target.value);
                    setVisibleCount(JOBS_PER_PAGE);
                  }}
                >
                  <option value="">All levels</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>
                  Work arrangement
                  <ChevronDown size={13} />
                </label>
                <select
                  value={workArrangement}
                  onChange={(e) => {
                    setWorkArrangement(e.target.value);
                    setVisibleCount(JOBS_PER_PAGE);
                  }}
                >
                  <option value="">All arrangements</option>
                  {WORK_ARRANGEMENTS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  <X size={13} /> Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="careers-results-section">
        <div className="container">
          {loading ? (
            <div className="no-results">
              <Loader2 size={40} className="spin" />
              <h3>Loading positions…</h3>
              <p>Fetching the latest openings.</p>
            </div>
          ) : loadError ? (
            <div className="no-results">
              <AlertCircle size={40} />
              <h3>Something went wrong</h3>
              <p>{loadError}</p>
            </div>
          ) : (
            <>
              <div className="careers-results-header">
                <span className="results-count">
                  <strong>{filtered.length}</strong> position
                  {filtered.length !== 1 ? "s" : ""} found
                  {hasActiveFilters && " · "}
                  {hasActiveFilters && (
                    <button className="inline-clear" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </span>
                <span className="results-sort">Sorted by most recent</span>
              </div>

              {filtered.length === 0 ? (
                jobs.length === 0 ? (
                  // No jobs at all — don't blame filters that aren't applied.
                  <div className="no-results">
                    <Search size={40} />
                    <h3>No open positions right now</h3>
                    <p>
                      We're not hiring for any roles at this exact moment. Check
                      back soon — new positions are posted regularly.
                    </p>
                  </div>
                ) : (
                  <div className="no-results">
                    <Search size={40} />
                    <h3>No positions match your criteria</h3>
                    <p>
                      Try adjusting your search or filters to find what you're
                      looking for.
                    </p>
                    <button
                      className="button button-blue"
                      onClick={clearFilters}
                    >
                      Clear all filters
                    </button>
                  </div>
                )
              ) : (
                <>
                  <div className="jobs-grid">
                    {visible.map((job) => (
                      <JobCard key={job.slug} job={job} />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="load-more-wrap">
                      <button
                        className="button button-dark"
                        onClick={() =>
                          setVisibleCount((c) => c + JOBS_PER_PAGE)
                        }
                      >
                        Load more positions ({filtered.length - visibleCount}{" "}
                        remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* CTA Banner */}
      <section className="careers-cta-band section-dark">
        <div className="container careers-cta-inner">
          <div>
            <div
              className="section-kicker light-eyebrow"
              style={{ marginBottom: 16 }}
            >
              DON'T SEE THE RIGHT ROLE?
            </div>
            <h2 className="careers-cta-heading">Send us your CV.</h2>
            <p className="careers-cta-sub">
              We keep a pool of strong candidates and match them to roles as
              they open. Email your CV to{" "}
              <a href={`mailto:${CAREERS_EMAIL}`} className="cta-email">
                {CAREERS_EMAIL}
              </a>{" "}
              and we will reach out when something fits.
            </p>
          </div>
          <a href={`mailto:${CAREERS_EMAIL}`} className="button button-mint">
            Get in touch <ArrowUpRight size={17} />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}
