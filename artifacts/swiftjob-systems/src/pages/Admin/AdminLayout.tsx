import { Link, Redirect } from "wouter";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Briefcase,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  Link2,
  LogOut,
  Send,
  Settings,
} from "lucide-react";
import { clearAdminToken, getAdminToken } from "@/lib/adminApi";

export type AdminView =
  | "overview"
  | "applications"
  | "referrals"
  | "contacts"
  | "jobs"
  | "mail"
  | "activity"
  | "settings";

const NAV_GROUPS: {
  label: string;
  items: {
    view: AdminView;
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
  }[];
}[] = [
  {
    label: "Dashboard",
    items: [
      {
        view: "overview",
        label: "Overview",
        href: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Hiring",
    items: [
      {
        view: "applications",
        label: "Applications",
        href: "/admin/applications",
        icon: ClipboardList,
      },
      {
        view: "referrals",
        label: "Referrals",
        href: "/admin/referrals",
        icon: Link2,
      },
      {
        view: "contacts",
        label: "Contacts",
        href: "/admin/contacts",
        icon: ContactRound,
      },
      { view: "jobs", label: "Jobs", href: "/admin/jobs", icon: Briefcase },
    ],
  },
  {
    label: "Communications",
    items: [
      { view: "mail", label: "Send mail", href: "/admin/mail", icon: Send },
    ],
  },
  {
    label: "System",
    items: [
      {
        view: "activity",
        label: "Activity log",
        href: "/admin/activity",
        icon: Activity,
      },
      {
        view: "settings",
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

interface AdminLayoutProps {
  view?: AdminView;
  children: ReactNode | ((token: string) => ReactNode);
}

export function AdminLayout({ view, children }: AdminLayoutProps) {
  const [token, setToken] = useState<string | null>(() => getAdminToken());
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    setToken(getAdminToken());
  }, []);

  if (!token) {
    return <Redirect to="/admin/login" />;
  }

  if (loggedOut) {
    return <Redirect to="/admin/login" />;
  }

  const handleLogout = () => {
    clearAdminToken();
    setLoggedOut(true);
  };

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link href="/admin" className="admin-brand">
          SwiftJob.adm
          <span className="admin-brand-area">admin</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="admin-logout-btn"
        >
          <LogOut size={15} />
          Logout
        </button>
      </header>

      <div className="admin-body">
        <nav className="admin-sidebar" aria-label="Admin navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <div className="admin-nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.view}
                  href={item.href}
                  className={`admin-nav-link${view === item.view ? " active" : ""}`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <main className="admin-main">
          {typeof children === "function" ? children(token) : children}
        </main>
      </div>
    </div>
  );
}
