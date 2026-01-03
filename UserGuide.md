# Admin and Super-Admin Provisioning Guide

This guide explains how to add admins or super-admins using the CLI script `scripts/add-admin.ts` and how the underlying data updates work.

## Prerequisites
- Ensure `DATABASE_URL` is set in your environment (e.g., via `.env`).
- Run the script with `pnpm tsx scripts/add-admin.ts` (or `npx tsx` if pnpm is unavailable).

## Interactive Flow
1. **Choose role**: Pick `admin` (default) or `super_admin`.
2. **Enter email**: The email is normalized to lowercase and validated.
3. **Select facilities** (admins only): The script lists facilities and accepts one or more IDs (space/comma separated). Super-admins skip this.
4. **Confirm**: The script echoes role, email, and facility names and asks for confirmation.
5. **Upsert user**:
   - If the email exists in `users`, the role is updated to the chosen role.
   - If not, a new user is inserted with placeholders: `name = "Yet to register"`, `loginMethod = "pending"`, and a generated `openId`. Timestamps (`createdAt`, `updatedAt`, `lastSignedIn`) are set to now.
6. **Link facilities** (admins only): Missing entries are inserted into `admin_facilities` for the selected facility IDs.

## Data Rules and Behavior
- **Role updates**: Existing users keep their other fields; only `role` and `updatedAt` change.
- **Placeholder users**: Created when an email is not yet in `users`. When the person later signs in, the auth flow should update their profile details while retaining the existing record.
- **Facility links**: Only new mappings are added; existing links are left untouched. Super-admins do not need facility mappings.
- **Validation**: Facility IDs must exist. Input must include at least one facility for admins. Role and email are validated before database writes.

## Troubleshooting
- **No facilities listed**: Add facilities first (e.g., via SQL or a facility management script) before assigning admins.
- **DATABASE_URL errors**: Verify the env var is present and reachable. The script exits early if it is missing.
- **Duplicate links**: The script de-duplicates facility selections and skips already-linked facilities.
- **Dry-run**: Choose "no" at the confirmation step to abort without writing to the database.

## Quick Reference
- Run: `pnpm tsx scripts/add-admin.ts`
- Default role: `admin`
- Facility selection: space/comma separated list of IDs (admins only)
- Confirmation required before any database changes
