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

## `src/pages/AdminDashboard.tsx`

This is the main Admin Dashboard page. It handles authentication to ensure that only the admins are able to access this page.

## `src/hooks`

The files in the hooks folder provide custom React hooks that encapsulate reusable logic for handling user input, device detection, and event management in the application.

## `src/lib`

The files in the lib folder provide utility functions and libraries that support the frontend React application:

- `trpc.ts`: Sets up type-safe tRPC React hooks for communicating with the backend API. It allows frontend components to easily call backend procedures (like [trpc.auth.me.useQuery()](vscode-file://vscode-app/c:/Users/prane/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html)) with full TypeScript type inference, ensuring type safety and reducing boilerplate.
- `utils.ts`: Exports a utility function [cn](vscode-file://vscode-app/c:/Users/prane/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) that combines and merges CSS class names using [clsx](vscode-file://vscode-app/c:/Users/prane/AppData/Local/Programs/Microsoft%20VS%20Code/resources/app/out/vs/code/electron-browser/workbench/workbench.html) and `tailwind-merge`. This helps manage dynamic and conditional Tailwind CSS class names in a clean and conflict-free way.

# Authentication

Across the applicaiton, authentication involves:

1. Checking if a session cookie has been created. A cookie will be created only if the user tries to login. No login attempt means no cookie will be created. This leads to the following warning being printed on the console: "[Auth] Missing session cookie"
2. If there is a cookies, data inside the cookie is decoded to determine user details from the login
3. If the user is not in the database, they are added to the database as a user. If they are, then the application will check their role.
4. If they are `admin`/`super_admin` then they will be granted to right to access the blocked web pages
