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

This defines behaviour when the server is started. The server uses the Express 4 Node.js web framework.

A separate OAuth enpoint is used because OAuth callbacks use query parameters and redirects, which don't fit the tRPC RPC model. Keeping it as a standard Express route simplifies the implementation.

## `_core/vite.ts`

This provides the method to run the vite server which is used in development.
