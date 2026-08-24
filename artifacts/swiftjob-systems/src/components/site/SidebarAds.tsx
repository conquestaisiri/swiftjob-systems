import { useCallback, useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  GradCapIcon,
  MonitorPlayIcon,
  SparkIcon,
  WrenchIcon,
} from "@/components/site/adIcons";

interface EduAd {
  tag: string;
  icon: "wrench" | "grad" | "monitor" | "spark";
  title: string;
  body: string;
  url: string;
  cta: string;
}

export const AD_ICONS = {
  wrench: WrenchIcon,
  grad: GradCapIcon,
  monitor: MonitorPlayIcon,
  spark: SparkIcon,
} as const;

export type AdPosition = "right-top" | "right-mid";

export const AD_POSITIONS: AdPosition[] = ["right-top", "right-mid"];

const SHOW_MS = 9_000;
const HIDE_MS = 4_000;
const ENTRANCE_MS = 650;

const VERIFIED = {
  windowHowTo: "https://www.thisoldhouse.com/how-to",
  diy: "https://www.familyhandyman.com",
  windowVideo:
    "https://www.youtube.com/results?search_query=how+to+install+a+window",
  coursera: "https://www.coursera.org",
  googleCerts: "https://www.coursera.org/google-career-certificates",
  edx: "https://www.edx.org",
  khan: "https://www.khanacademy.org",
};

const EDU_ADS: EduAd[] = [
  {
    tag: "SKILL · WINDOWS",
    icon: "wrench",
    title: "Learn to repair a broken window pane",
    body: "Free step-by-step guides from This Old House — glazing, sash repair, and frames that a complete beginner can follow safely.",
    url: VERIFIED.windowHowTo,
    cta: "Read the free guide",
  },
  {
    tag: "SKILL · WINDOWS",
    icon: "wrench",
    title: "How to install a window, taught visually",
    body: "Picture-by-picture instructions from The Family Handyman: measuring, fitting, and sealing a new window the right way.",
    url: VERIFIED.diy,
    cta: "See the how-to",
  },
  {
    tag: "SKILL · WINDOWS",
    icon: "monitor",
    title: "Watch someone install a window start to finish",
    body: "Free video lessons on YouTube walk through caulking, flashing, and fitting — watch before you ever touch a tool.",
    url: VERIFIED.windowVideo,
    cta: "Watch the lesson",
  },
  {
    tag: "SKILL · COMPUTERS",
    icon: "grad",
    title: "Free computer skills that pay",
    body: "Coursera's free career courses cover the office basics employers actually ask about — files, email, spreadsheets, remote tools.",
    url: VERIFIED.coursera,
    cta: "Start a free course",
  },
  {
    tag: "SKILL · CAREER",
    icon: "grad",
    title: "Get job-ready with free certificates",
    body: "Google Career Certificates on Coursera are free to audit — customer support, IT, data, and UX paths built for beginners.",
    url: VERIFIED.googleCerts,
    cta: "Browse free certs",
  },
  {
    tag: "SKILL · CAREER",
    icon: "grad",
    title: "University courses, free to take",
    body: "edX hosts free college-level courses on business, technology, and communication — audit any of them at no cost.",
    url: VERIFIED.edx,
    cta: "Audit a course",
  },
  {
    tag: "SKILL · FOUNDATIONS",
    icon: "spark",
    title: "Learn math, coding, and economics for free",
    body: "Khan Academy teaches the foundations you'll need for almost any skilled role — completely free, no sign-up traps.",
    url: VERIFIED.khan,
    cta: "Learn for free",
  },
  {
    tag: "SKILL · FOUNDATIONS",
    icon: "spark",
    title: "Learn how business money works",
    body: "Khan Academy's free economics and personal-finance courses build the sense every professional role trusts — free, no sign-up traps.",
    url: VERIFIED.khan,
    cta: "Learn for free",
  },
  {
    tag: "SKILL · OFFICE",
    icon: "grad",
    title: "Spreadsheet skills that open doors",
    body: "Free Coursera courses teach the spreadsheet and data basics used in entry-level office roles — audit them at no cost.",
    url: VERIFIED.coursera,
    cta: "Start a free course",
  },
  {
    tag: "SKILL · HANDY",
    icon: "wrench",
    title: "Fixing things around the house is a skill",
    body: "The Family Handyman's free articles teach real repair skills you can use at home — and on gigs that pay.",
    url: VERIFIED.diy,
    cta: "Start learning",
  },
  {
    tag: "SKILL · WINDOWS",
    icon: "monitor",
    title: "Window weatherproofing, free lesson",
    body: "Seal and insulate like a pro: This Old House's how-to hub shows the exact steps and tools for drafty windows.",
    url: VERIFIED.windowHowTo,
    cta: "Open the lesson",
  },
  {
    tag: "SKILL · CAREER",
    icon: "grad",
    title: "Communication skills for remote teams",
    body: "edX's free communication and business-writing courses sharpen the skills every remote role values.",
    url: VERIFIED.edx,
    cta: "Audit a course",
  },
];

const TICKER = [
  "window repair",
  "window installation",
  "computer basics",
  "free certificates",
  "DIY skills",
  "remote work basics",
  "spreadsheet skills",
];

/**
 * One ad pop-up. It bounces in at one spot, stays ~9s, closes, waits ~4s,
 * then bounces in at a different spot on the page — forever, until dismissed.
 */
export function SidebarAds() {
  const [adIndex, setAdIndex] = useState(() =>
    Math.floor(Math.random() * EDU_ADS.length),
  );
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [position, setPosition] = useState<AdPosition>("right-mid");
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("swiftjob_ad_dismissed") === "1",
  );

  const nextPosition = useCallback((current: AdPosition) => {
    const others = AD_POSITIONS.filter((p) => p !== current);
    return others[Math.floor(Math.random() * others.length)];
  }, []);

  useEffect(() => {
    let timeouts: number[] = [];
    let alive = true;

    const loop = () => {
      timeouts.push(
        window.setTimeout(() => {
          if (!alive) return;
          setLeaving(true);
          timeouts.push(
            window.setTimeout(() => {
              if (!alive) return;
              setVisible(false);
              setLeaving(false);
              setPosition((current) => nextPosition(current));
              timeouts.push(
                window.setTimeout(
                  () => {
                    if (!alive) return;
                    setVisible(true);
                    loop();
                  },
                  HIDE_MS - ENTRANCE_MS + 400,
                ),
              );
            }, 380),
          );
        }, SHOW_MS),
      );
    };

    loop();
    return () => {
      alive = false;
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [nextPosition]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setAdIndex((current) => {
        let next = Math.floor(Math.random() * EDU_ADS.length);
        if (next === current) next = (next + 1) % EDU_ADS.length;
        return next;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused]);

  if (dismissed) return null;

  const ad = EDU_ADS[adIndex % EDU_ADS.length];
  const Icon = AD_ICONS[ad.icon];

  return (
    <aside
      className={`sidebar-ad sidebar-ad--${position}${leaving ? " sidebar-ad--out" : ""}`}
      aria-label="Educational ad"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {visible && (
        <>
          <div className="ad-marquee" aria-hidden="true">
            <span>
              {TICKER.map((t, i) => (
                <em key={`${t}-${i}`}>{t} • </em>
              ))}
              {TICKER.map((t, i) => (
                <em key={`${t}-dup-${i}`}>{t} • </em>
              ))}
            </span>
          </div>

          <div className="ad-body" key={`${ad.tag}-${ad.title}-${adIndex}`}>
            <div className="ad-head">
              <span className="ad-pill">AD</span>
              <span className="ad-live">
                <i /> {ad.tag}
              </span>
            </div>
            <h4>{ad.title}</h4>
            <p>{ad.body}</p>
            <a
              className="ad-cta"
              href={ad.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon size={14} /> {ad.cta} <ExternalLink size={13} />
            </a>
          </div>

          <div className="ad-progress" aria-hidden="true">
            {!paused && <i key={`prog-${adIndex}`} />}
          </div>
        </>
      )}

      <button
        className="sidebar-ad-close"
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("swiftjob_ad_dismissed", "1");
        }}
        aria-label="Dismiss ad"
      >
        <X size={14} />
      </button>
    </aside>
  );
}
