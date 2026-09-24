/** A role assessment is visible only after both independent gates are met. */
export function canAccessRoleAssessment(
  applicationStatus: string,
  techCheckStatus: string,
): boolean {
  return applicationStatus === "Shortlisted" && techCheckStatus === "completed";
}
