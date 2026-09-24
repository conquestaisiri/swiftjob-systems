import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { AdminLayout } from "@/pages/Admin/AdminLayout";

// Route-level chunks keep the public landing page small while preserving the
// same route components and data flow. The admin and candidate surfaces load
// only when a visitor navigates to them.
const LandingPage = lazy(() =>
  import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const CareersPage = lazy(() =>
  import("@/pages/CareersPage").then((m) => ({ default: m.CareersPage })),
);
const JobPage = lazy(() =>
  import("@/pages/JobPage").then((m) => ({ default: m.JobPage })),
);
const ApplicationSuccess = lazy(() =>
  import("@/pages/ApplicationSuccess").then((m) => ({
    default: m.ApplicationSuccess,
  })),
);
const AssessmentPage = lazy(() =>
  import("@/pages/AssessmentPage").then((m) => ({ default: m.AssessmentPage })),
);
const CandidateLogin = lazy(() =>
  import("@/pages/CandidateLogin").then((m) => ({ default: m.CandidateLogin })),
);
const CandidateVerify = lazy(() =>
  import("@/pages/CandidateVerify").then((m) => ({
    default: m.CandidateVerify,
  })),
);
const CandidateApplications = lazy(() =>
  import("@/pages/CandidateApplications").then((m) => ({
    default: m.CandidateApplications,
  })),
);
const CandidateReferrals = lazy(() =>
  import("@/pages/CandidateReferrals").then((m) => ({ default: m.CandidateReferrals })),
);
const CandidateProfile = lazy(() =>
  import("@/pages/CandidateProfile").then((m) => ({ default: m.CandidateProfile })),
);
const CandidateReferralLanding = lazy(() =>
  import("@/pages/CandidateReferralLanding").then((m) => ({ default: m.CandidateReferralLanding })),
);
const ReferralPage = lazy(() =>
  import("@/pages/ReferralPage").then((m) => ({ default: m.ReferralPage })),
);
const CampaignLanding = lazy(() =>
  import("@/pages/CampaignLanding").then((m) => ({
    default: m.CampaignLanding,
  })),
);
const PrivacyPolicy = lazy(() =>
  import("@/pages/Legal").then((m) => ({ default: m.PrivacyPolicy })),
);
const TermsOfService = lazy(() =>
  import("@/pages/Legal").then((m) => ({ default: m.TermsOfService })),
);
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminLogin = lazy(() =>
  import("@/pages/Admin/AdminLogin").then((m) => ({ default: m.AdminLogin })),
);
const Applications = lazy(() =>
  import("@/pages/Admin/Applications").then((m) => ({
    default: m.Applications,
  })),
);
const Overview = lazy(() =>
  import("@/pages/Admin/Overview").then((m) => ({ default: m.Overview })),
);
const Settings = lazy(() =>
  import("@/pages/Admin/Settings").then((m) => ({ default: m.Settings })),
);
const JobsAdmin = lazy(() =>
  import("@/pages/Admin/JobsAdmin").then((m) => ({ default: m.JobsAdmin })),
);
const ReferralsAdmin = lazy(() =>
  import("@/pages/Admin/ReferralsAdmin").then((m) => ({
    default: m.ReferralsAdmin,
  })),
);
const CandidateReferralRewardsAdmin = lazy(() =>
  import("@/pages/Admin/CandidateReferralRewardsAdmin").then((m) => ({
    default: m.CandidateReferralRewardsAdmin,
  })),
);
const ContactsAdmin = lazy(() =>
  import("@/pages/Admin/ContactsAdmin").then((m) => ({
    default: m.ContactsAdmin,
  })),
);
const MailAdmin = lazy(() =>
  import("@/pages/Admin/MailAdmin").then((m) => ({ default: m.MailAdmin })),
);
const CampaignsAdmin = lazy(() =>
  import("@/pages/Admin/CampaignsAdmin").then((m) => ({
    default: m.CampaignsAdmin,
  })),
);
const ActivityAdmin = lazy(() =>
  import("@/pages/Admin/ActivityAdmin").then((m) => ({
    default: m.ActivityAdmin,
  })),
);

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Suspense
            fallback={
              <div className="page-loading" role="status">
                Loading…
              </div>
            }
          >
            <Switch>
              <Route path="/" component={LandingPage} />
              <Route path="/login" component={CandidateLogin} />
              <Route path="/login/confirm" component={CandidateVerify} />
              <Route
                path="/candidate/applications"
                component={CandidateApplications}
              />
              <Route path="/candidate/profile" component={CandidateProfile} />
              <Route path="/candidate/referrals" component={CandidateReferrals} />
              <Route
                path="/careers/apply/success"
                component={ApplicationSuccess}
              />
              <Route path="/assessment" component={AssessmentPage} />
              <Route path="/privacy" component={PrivacyPolicy} />
              <Route path="/terms" component={TermsOfService} />
              <Route path="/careers/:slug" component={JobPage} />
              <Route path="/careers" component={CareersPage} />
              <Route path="/referral/:code" component={ReferralPage} />
              <Route path="/r/:code" component={CandidateReferralLanding} />
              <Route path="/campaign/:slug" component={CampaignLanding} />
              <Route path="/admin/login" component={AdminLogin} />
              <Route path="/admin">
                <AdminLayout view="overview">
                  <Overview />
                </AdminLayout>
              </Route>
              <Route path="/admin/applications">
                <AdminLayout view="applications">
                  {(token) => <Applications token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/referrals">
                <AdminLayout view="referrals">
                  {(token) => <ReferralsAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/candidate-referrals">
                <AdminLayout view="candidate-referrals">
                  {(token) => <CandidateReferralRewardsAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/contacts">
                <AdminLayout view="contacts">
                  {(token) => <ContactsAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/jobs">
                <AdminLayout view="jobs">
                  {(token) => <JobsAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/mail">
                <AdminLayout view="mail">
                  {(token) => <MailAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/campaigns">
                <AdminLayout view="campaigns">
                  <CampaignsAdmin />
                </AdminLayout>
              </Route>
              <Route path="/admin/activity">
                <AdminLayout view="activity">
                  {(token) => <ActivityAdmin token={token} />}
                </AdminLayout>
              </Route>
              <Route path="/admin/settings">
                <AdminLayout view="settings">
                  <Settings />
                </AdminLayout>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
