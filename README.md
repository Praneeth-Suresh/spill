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

HTTP is used in development mode so the cookies are not secure.

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
- Updates store the public activity feed (date, person, content blob, relevance). Content uses double newlines (`\n\n`) to delimit paragraphs for display.

Each of the above sets of data corresponds to a table.

To allow flexible database use, an ORM is used so that the exact database can be changed as per demands of information security.

If the database schema is changed in the future, run:

```bash
pnpm db:push
```

This generates SQL migration files in `drizzle/migrations/`, and applies them to the database. This manages the process of working with tables without needing to write SQL.

To view the database through an interactive winodw, use:

```bash
pnpm exec drizzle-kit studio
```

To handle the hosted database, use the MySQL shell and the provided connection URL to connect to the database directly. Once inside the database, the tables can be created in one fell swoop by copy-pasting the commands in `mysql-init/0000_careful_karnak.sql`.

> [!WARNING]
>
> Be sure to ensure that the `.sql` file in `mysql_init` is up to date with the database. If it needs to be updated, use drizzle but change `out` accordingly in `drizzle.config.ts`.

### Seeding Data

For the purposes of testing the application, we are going to use seed data. This means that we don't need to manually write in content to the database before testing the application.

First, populate the information into `scripts/seed-db.ts` then run this seed script with the following command:

```bash
pnpm exec tsx scripts/seed-db.ts
```

If this runs successfully, you should get the message `✅ Seeding complete`. Note that this command cannot be run multiple times because once data is already inserted, making any changes using the `INSERT` command will produce a duplicate entry error.

To seed the database in the hosting platform, set the `DATABASE_URL` in the `.env` file to the URL of the SQL database. Then run the above command to seed the database.

Note that Drizzle does not automatically create tables on seed. For this you need to run migrations. So, if you need to create tables again because the database changed, then run these commands:

```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit migrate
```

### Manual data entry for updates

- `content` should use double newlines (`\n\n`) between paragraphs; each paragraph is rendered separately.
- `relevance` is an integer 1–10; the top three scores (ties broken by most recent `date`) are shown on `/updates`.
- Use the same date format as other tables (timestamp); local server time is used for “today” checks.

## Running Tests

This is how to run the test suite:

```bash
pnpm test
```

Ensure your tests use a separate test database to avoid polluting production data.

## Deployment

To set up environment variables, follow the documentation for required environment variables in `.env.example`.

To run the application in production, use:

```bash
pnpm build
node dist/index.js
```

This uses HTTPS so access the application at `https://...`. HTTPS is used because in the production environement, cookies need to be secure which is only available through HTTPS. This requires that a self-signed certificate is created and available in the root directory. If there is no self-signed certificate available, run the following command in the root directory:

```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

However, note than login will not work because OAuth providers do not trust self-authorized SSL-certs. This mode is only for testing that cookies work as expected with HTTPS.

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

Note that the container is a **production container** so it will work **only if** the environment variable `NODE_ENV` is set to `production`. Development dependencies are not installed within the container because this increases image size.

Since development dependencies are not in the container, the code is carefully crafted to ensure that none of the development dependencies (particularly `vite`) are bundled into `dist`.

## Railway Hosting

This app is hosted on Railway. Here are some of the key points to take note about the hosting:

- The quickest way to understand the status of the hosting is through the GUI. Navigate to https://railway.app and navigate to the project.
- The code is deployed through GitHub. This means that any change to this repo will automatically be refelcted in the applicaiton. Thus, be sure to ensure that proper testing is done before the app is pushed to the main branch (follow appropriate CI/CD practises).
- Ensure that the envrionment variables are all correctly set. There are a few variables that change when hosted, including: `GOOGLE_OAUTH_REDIRECT_URI`.
- Working with the database can be done in three ways:
  - Use the GUI provided by Railway to manually manage tables (this is not recommended because it provides limited control)
  - Use drizzle to manage the database by changing the `DATABSE_URL` envrionment variables on a local machine. Then the standard drizzle commands to update and seed the database can be used.
  - Connect to the database from MySQL shell for full access, using the link provided by Railway.

- The hosted app can also be managed using the Railway shell. These are the commands needed to set it up:ra

  ```bash
  # Install the railway CLI using npm
  npm i -g @railway/cli

  # Connect to the service that you want to work with
  railway link
  railway shell
  ```

- One useful command that can be used from the Railway CLI is `railway logs` to see the live logs from the Railway deployment.

## Taking this project forward

Here are some of the things that are in the pipeline for this project.

I am looking at implementing real-time uvpdates with WebSocket connections, adding email notifications for critical issues, implementing rate limiting to prevent abuse, adding more analytics visualizations and creating a mobile app with React Native.
