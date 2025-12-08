# Frontend

Here are the roles played by the key files in the front-end:

## `src/main.tsx`

This creates the tRPC provider. This handles caching, refetching and background updates.

`httpBatchLink` is used so that if a component makes multiple tRPC calls (e.g., fetch user, fetch questions, fetch responses), batching combines them into a single HTTP request. This reduces network overhead and improves performance.

`superjson` handles Date serialization automatically.

## `src/_core/hooks/useAuth.ts`

This creates a custom authentication hook.

Wrapping trpc.auth.me.useQuery() in a custom hook provides a consistent API across the application and makes it easy to add additional auth-related logic later.

## `src/App.tsx`

This is the core app component which defines routing to the various endpoints needed for the app.

This application chooses to use Wouter. Wouter is 2KB (vs 20KB for React Router), has a simpler API, and provides all the routing features needed for this application. For larger applications with complex routing requirements, React Router might be better.

## `src/pages/QuestionPage.tsx`

This defines the question page. Note that the disclaimer is presented as a section of its own, hardcoded into this page.

A key design feature is flexibility of question style. Each question type has different data requirements (poll: option IDs, text: string, file: file ID). Keeping them separate makes validation and submission logic clearer.

The application uses toast notification. Toast notifications provide non-intrusive feedback for success and error states without blocking the UI or requiring user interaction to dismiss.
