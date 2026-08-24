import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { CareersPage } from "@/pages/CareersPage";
import { JobPage } from "@/pages/JobPage";
import { ApplicationSuccess } from "@/pages/ApplicationSuccess";
import { AssessmentPage } from "@/pages/AssessmentPage";
import { CandidateLogin } from "@/pages/CandidateLogin";
import { CandidateVerify } from "@/pages/CandidateVerify";
import { CandidateApplications } from "@/pages/CandidateApplications";
import { ReferralPage } from "@/pages/ReferralPage";
import { CampaignLanding } from "@/pages/CampaignLanding";
import { LandingPage } from "@/pages/LandingPage";
import NotFound from "@/pages/not-found";
import { AdminLayout } from "@/pages/Admin/AdminLayout";
import { AdminLogin } from "@/pages/Admin/AdminLogin";
import { Applications } from "@/pages/Admin/Applications";
import { Overview } from "@/pages/Admin/Overview";
import { Settings } from "@/pages/Admin/Settings";
import { JobsAdmin } from "@/pages/Admin/JobsAdmin";
import { ReferralsAdmin } from "@/pages/Admin/ReferralsAdmin";
import { ContactsAdmin } from "@/pages/Admin/ContactsAdmin";
import { MailAdmin } from "@/pages/Admin/MailAdmin";
import { CampaignsAdmin } from "@/pages/Admin/CampaignsAdmin";
import { ActivityAdmin } from "@/pages/Admin/ActivityAdmin";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/login" component={CandidateLogin} />
            <Route path="/login/confirm" component={CandidateVerify} />
            <Route
              path="/candidate/applications"
              component={CandidateApplications}
            />
            <Route
              path="/careers/apply/success"
              component={ApplicationSuccess}
            />
            <Route path="/assessment" component={AssessmentPage} />
            <Route path="/careers/:slug" component={JobPage} />
            <Route path="/careers" component={CareersPage} />
            <Route path="/referral/:code" component={ReferralPage} />
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
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
