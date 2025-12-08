import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

/**
 * Create tRPC React hooks
 * 
 * This provides type-safe hooks like trpc.auth.me.useQuery()
 * Types are automatically inferred from the backend AppRouter
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * TypeScript extracts the types from AppRouter (defined in backend) 
 * and makes them available in the frontend. When you call 
 * trpc.auth.me.useQuery(), TypeScript knows the return type without 
 * any manual type definitions.
 */