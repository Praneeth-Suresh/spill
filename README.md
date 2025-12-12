# Spill

## Development

Development and production builds run differently, as defined in `server/_core/index.ts`.During development, vite is used.

To allow the development build to run, set:

```plaintext
NODE_ENV=development
```

in `.env`. Otherwise, set it to `production`.

To run the development server, use:

```bash
pnpm dev
```

This will:

- Start the Express server on post 3000
- Start Vite dev server with HMR (Hot Module Replacement)
- Watch for file changes and auto-reload

**Note** that `cross-env` is used to ensure that the application can process envrionment variables correctly when using Windows.

> [!WARNING]
>
> Always ensure that the database is set up before running the app.

## Repository Structure

Here is the role played by the directories in this project:

- The server/ directory contains all backend code with \_core/ for framework-level infrastructure.
- The client/ directory contains all frontend code organized by function.
- The drizzle/ directory holds database schema and migrations.
- The shared/ directory contains code used by both frontend and backend.
- The scripts/ directory holds utility scripts for seeding, migrations, etc.

The runtime deduces the part of the codebase required for each segment of the application using the configuration files:

- `tsconfig` for typescript configuration. In this project, TypeScript only checks types, doesn't compile (Vite and esbuild handle compilation).
- `drizzle.config.ts` to configure drizzle so that it can access the right database using the appropriate credentials.
- `vite.config.ts` as vite configuration. In development, Vite runs on port 3000 (frontend) and Express runs on port 3001 (backend). The proxy forwards /api requests to the backend, avoiding CORS issues.
- `vitest.config.ts` configures vitest which handles comprehensive tests for the application.

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

### Seeding Data

For the purposes of testing the application, we are going to use seed data. This means that we don't need to manually write in content to the database before testing the application.

First, populate the information into `scripts/seed-db.ts` then run this seed script with the following command:

```bash
pnpm exec tsx scripts/seed-db.ts
```

If this runs successfully, you should get the message `✅ Seeding complete`. Note that this command cannot be run multiple times because once data is already inserted, making any changes using the `INSERT` command will produce a duplicate entry error.

Note that Drizzle does not automatically create tables on seed. For this you need to run migrations. So, if you need to create tables again because the database changed, then run these commands:

```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit push
```

## Running Tests

This is how to run the test suite:

```bash
pnpm test
```

Ensure your tests use a separate test database to avoid polluting production data.

## Deployment

To set up environment variables, follow the documentation for required environment variables in `.env.example`.

### Docker

A multi-stage build is used. This reduces the final image size by excluding development dependencies and build tools. The builder stage compiles the code, and the production stage only includes the compiled output and runtime dependencies.

Alpine Linux is chosen because Alpine is a minimal Linux distribution (5MB vs 100MB+ for Ubuntu), resulting in smaller Docker images and faster deployments.

Here is what the DockerFile does:

**Build Stage**

- Installs pnpm
- Installs all dependencies
- Builds frontend and backend with pnpm build

**Runtime Stage**

- Installs only production dependencies
- Copies built artifacts (dist, drizzle)
- Copies drizzle.config.ts (needed for Drizzle ORM)
- Exposes port 3000
- Healthcheck matches compose file
- Starts app with node dist/index.js

Here is how the docker compose setup can be done:

```bash
docker-compose up --build
```

If you make any changes to the codebase, then use the command:

```bash
docker-compose build --no-cache
```

to ensure that any fixes are carried through to the image.

## Taking this project forward

Here are some of the things that are planned in the pipeline for this project.

I am looking at implementing real-time updates with WebSocket connections, adding email notifications for critical issues, implementing rate limiting to prevent abuse, adding more analytics visualizations and creating a mobile app with React Native.
