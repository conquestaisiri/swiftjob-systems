# Role and permission baseline

| Operation | Visitor | Candidate | Admin | Baseline |
|---|---|---|---|---|
| Read active vacancies/legal/contact pages | Yes | Yes | Yes | Public browsing VERIFIED |
| Submit application/contact | Yes | Yes | Yes | Application accepts invalid business state; valid contact fails |
| Request/consume email sign-in link | Yes | Yes | Yes | Source reviewed; local full lifecycle pending |
| Set candidate password | Must verify email first | Own email only | No implicit candidate ownership | CRITICAL: public application ID/email currently sufficient |
| Read candidate applications/resumes | No | Own records | Admin endpoints | Anonymous denial VERIFIED; cross-account regression pending |
| Candidate status/room data | No | Own published status only | Manage | Raw room fields are returned for unshortlisted records (source) |
| Manage jobs/applications/contacts/referrals/campaigns/mail/settings/activity | No | No | Yes | API guards mapped; local admin login/read screens VERIFIED |
| Assessment/technical check | Application-bound capability | Own application | Review | Current email/ID capability and job-track handling need repair |
| Referral landing | Bearer referral code | Same | Manage | Code grants access; server state and device gating reviewed |

No separate employer role exists. UI hiding is not authorization. `evidence/active-api-routes.json` enumerates 75 route/middleware registrations with source lines and named middleware. Candidate session claims, revocation and admin JWT validation require regression tests across all protected endpoints.
