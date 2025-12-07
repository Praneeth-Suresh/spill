# Spill

## Repository Structure

Here is the role played by the directories in this project:

- The server/ directory contains all backend code with \_core/ for framework-level infrastructure.
- The client/ directory contains all frontend code organized by function.
- The drizzle/ directory holds database schema and migrations.
- The shared/ directory contains code used by both frontend and backend.
- The scripts/ directory holds utility scripts for seeding, migrations, etc.

The runtime deduces the part of the codebase required for each segment of the application using the configuration files:

- `tsconfig` for typescript configuration. In this project, TypeScript only checks types, doesn't compile (Vite and esbuild handle compilation).
-

## Database design

Here are the key pieces of information that the database is designed to store:

- Users need to be stored with authentication information and roles.
- Facilities represent physical locations or organizational units.
- Admin assignments map admins to facilities.
- Questions define feedback prompts with various types and configurations.
- Question options provide choices for poll questions.
- Responses record user submissions with IP logging.
- Response answers store individual answer data.
- Uploaded files track file metadata and S3 references.
- Question branching defines conditional navigation rules.

Each of the above sets of data corresponds to a table.

To allow flexible database use, an ORM is used so that the exact database can be changed as per demands of information security.

If the database schema is changed in the future, run:

```bash
pnpm db:push
```

This generates SQL migration files in `drizzle/migrations/`, and applies them to the database. This manages the process of working with tables without needing to write SQL.

### Testing

For the purposes of testing the application, we are going to use seed data. This means that we don't need to manually write in content to the database before testing the application.

First, populate the information into `scripts/seed-db.ts` then run this seed script with the following command:

```bash
pnpm exec tsx scripts/seed-db.ts
```

If this runs successfully, you should get the message `✅ Seeding complete`.
