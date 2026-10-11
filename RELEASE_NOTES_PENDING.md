# Perllon: release readiness

## Verified
- Existing 80 tests pass in the fix branch.
- Build completes in GitHub Actions.
- The existing product edit screen includes a confirmed permanent-delete action in this branch only.

## Required before merging or selling
- Test product deletion against a disposable test item in a nonproduction Supabase instance.
- Add automated deletion tests.
- Identify and fix the npm high-severity dependency advisory; rerun npm audit.
- Verify password recovery and administrator account protections.
- Verify domain ownership, metadata, business details, image rights and privacy policy.
- Validate live production flows with the business owner.
- Agree on code licensing, support, hosting and maintenance.

Do not merge the branch or treat the project as production-ready until the above checks have been completed.
