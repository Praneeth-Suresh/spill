# Server Logic

Here is what the files in this directory do:

## `db.ts`

These are database helper functions.

Separating database queries into helper functions provides reusability across multiple API endpoints, easier testing by mocking individual functions, centralized error handling, and clearer business logic in API routes.

## `_core/trpc.ts`

**tRPC** (TypeScript Remote Procedure Call) is a framework for building **end-to-end type-safe APIs** without the need for manual schema definitions or code generation.

When you define an API endpoint (called a "procedure"), tRPC automatically shares its input arguments, return type, and potential errors with the client, ensuring the frontend and backend are always in sync at compile time.

tRPC also allows middleware to be elegantly included. This middleware enables authentication checks, authorization checks, logging, and context enrichment.

## `_core/context.ts`

This module creates tRPC context for each request. This runs before every tRPC procedure call, extracts JWT from cookie, verifies it, and loads user from database.

## `_core/index.ts`

This defines behaviour when the **express** server is started. The server uses the Express 4 Node.js web framework.

A separate OAuth enpoint is used because OAuth callbacks use query parameters and redirects, which don't fit the tRPC RPC model. Keeping it as a standard Express route simplifies the implementation.

## `_core/vite.ts`

This provides the method to run the vite server which is used in development.

## `_core/oauth.ts`

Here is the flow of OAuth2:

1. When the user clicks log in, they are redirected to the OAuth portal. This is where they authenticate.
2. OAuth portal redirects back to `/api/oauth/callback?code=...`
3. Then the server gets the access token, using which it fetches user info
4. Server creates/updates user in database
5. Server generates JWT (JSON Web Token) and sets session cookie

Once this is done, the user is redirected to the page.

> A JWT is used to securely transmit information between parties as a JSON object.

The file `oauth.ts` defines the OAuth Handler.

## `_core/sdk.ts`

This file provides an SDK for authenticating users via OAuth, managing session tokens with JWTs, and synchronizing user info with a local database. The OAuth provider we are working with now is Google, through whom we are going to get users to login.

## `_core/cookies.ts`

The role of this script is to manage cookie creation. Here are key configurations used here:

- HttpOnly cookies cannot be accessed by JavaScript, preventing XSS attacks from stealing session tokens. This is critical for security.
- SameSite: "none" allows the cookie to be sent with the OAuth cross-site requests. This requires secure: true (HTTPS).
- In development (HTTP), secure cookies don't work. But in production (HTTPS), secure cookies are required for security

## `_core/systemRouter.ts`

This file defines a TRPC router for system-level endpoints, including:

**health**: A public endpoint for health checks, which simply returns { ok: true }.

**notifyOwner** : An admin-only endpoint that accepts a title and content, validates them, and calls [notifyOwner](vscode-file://vscode-app/c:/Users/prane/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) from [notification.ts](vscode-file://vscode-app/c:/Users/prane/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) to send the notification. It returns whether the notification was successfully delivered.

## `_core/env.ts`

This loads and defines fallbacks for missing envrionment variables.

## `routers.ts`

This defines all the endpoints. This includes the question and the admin endpoints.

Note that file upload has a separate endpoint. File uploads happen before form submission (so users see upload progress). The upload returns a fileId, which is then included in the form submission.

When behind a reverse proxy (like Railway, Nginx, or Cloudflare), `req.socket.remoteAddress` is the proxy's IP, not the user's. The `x-forwarded-for` header contains the original client IP.

This file is key for security because it ensures that only the permitted users can access the relevant endpoints.

## `branching.ts`

This defines the key branching logic. A branching logic allows a series of questions to be created. It also allows a redirect to a fresh question page once the question is answered.

Here is the branching algorithms:

1. Load all active branching rules for the question (sorted by priority)
2. For each rule, check if condition matches
3. Return first matching rule's destination
4. If no rules match, return question's default nextQuestionId

Multiple rules might match the same response. Priority ensures deterministic behavior - the rule with the lowest priority number wins. This allows complex logic like "if option A, go to Q5; if option B, go to Q6; otherwise go to Q7".

## `storage.ts`

This is the storage logic used to store any files that the user uploads. For now, a database to store the uploaded material has not been identified yet. Thus the file upload functionality doesn't work.

# Tests

## `auth.test.ts`

The tests work my mocking authentication contexts. Testing authentication requires simulating different user states (authenticated, unauthenticated, different roles). Mocking the context allows us to test authorization logic without actually logging in.

Authorization bugs can have serious security implications. Testing each role's access ensures that regular users can't access admin endpoints, admins can't access super admin endpoints, etc. This is why they are an important part of the testing that takes place.

## `questions.test.ts`

Here is where all the tests about sequencing, branching logic and navigation flows go.

## `auth.logout.test.ts`

Here, we have tests that specifically test the logout functionality of the application's authentication system.

It verifies that when the logout endpoint is called, the session cookie is properly cleared with the correct options and a success response is returned.

It helps guarantee that users can reliably log out and that their session data is invalidated, which is a critical aspect of application security and user experience.
