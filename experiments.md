# A/B Testing with GrowthBook - Complete Guide

This guide walks you through the complete process of setting up, running, and analyzing A/B tests in the Spill application using GrowthBook.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setting Up an Experiment](#setting-up-an-experiment)
4. [Implementing Experiments in Code](#implementing-experiments-in-code)
5. [Analyzing Results](#analyzing-results)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The A/B testing system uses [GrowthBook](https://www.growthbook.io/) to manage experiments and track user interactions. It's designed to be:

- **Non-invasive**: Analytics act as a wrapper around existing functionality
- **Persistent**: User assignments are tracked via device IDs and session IDs
- **Flexible**: Experiments can be targeted by page or question
- **Accurate**: Exposure and conversion tracking for reliable statistical analysis

## Architecture

### Key Components

1. **Database Tables**:
   - `experiments`: Stores experiment configurations
   - `experiment_exposures`: Tracks when users see experiment variations

2. **Backend**:
   - `server/db.ts`: Database operations for experiments
   - `server/routers/experiments.ts`: tRPC endpoints for experiment management
3. **Frontend**:
   - `client/src/hooks/useGrowthBook.ts`: React hooks for A/B testing
   - `client/src/pages/AdminExperiments.tsx`: Admin interface for creating experiments
   - `client/src/pages/ExperimentResults.tsx`: Results visualization

### Data Flow

```
1. Frontend requests experiment config → tRPC → Backend
2. Backend queries active experiments → Returns GrowthBook config
3. GrowthBook assigns user to variation → Displays content
4. User interaction tracked → Exposure saved to database
5. Admin views results → Conversion rates calculated
```

## Setting Up an Experiment

### Step 1: Plan Your Experiment

Before creating an experiment, define:

- **Hypothesis**: What are you testing? (e.g., "Red buttons get more clicks than green buttons")
- **Variations**: What are the different versions? (e.g., Control: green, Variant A: red)
- **Success Metric**: How do you measure success? (e.g., click-through rate, form submissions)
- **Sample Size**: How many users do you need for statistical significance?
- **Duration**: How long will the test run?

### Step 2: Create Database Migration

First, ensure the database schema includes the experiments tables. If not already migrated, create a migration:

```bash
pnpm drizzle-kit generate:mysql
pnpm drizzle-kit push:mysql
```

The schema includes:

```typescript
// experiments table
{
  id: number,
  key: string,                    // e.g., "button-color-test"
  name: string,                   // e.g., "Button Color A/B Test"
  description: string | null,
  isActive: boolean,
  variations: JSON,               // [{ id: "0", name: "Control", value: "#00FF00" }, ...]
  weights: JSON | null,           // [0.5, 0.5] for 50/50 split
  coverage: number,               // 100 = all users, 50 = half of users
  condition: JSON | null,         // Optional targeting rules
  pagePath: string | null,        // "/home" or null for all pages
  questionId: number | null,      // Question ID or null
  createdAt: timestamp,
  updatedAt: timestamp
}

// experiment_exposures table
{
  id: number,
  deviceId: string,
  sessionId: string,
  experimentKey: string,
  variationId: string,
  pagePath: string | null,
  questionId: number | null,
  ipAddress: string | null,
  userAgent: string | null,
  exposedAt: timestamp
}
```

### Step 3: Create the Experiment via Admin UI

1. Navigate to `/admin/experiments` (must be logged in as admin)
2. Fill in the experiment details:
   - **Experiment Key**: Unique identifier (e.g., `button-color-test`)
   - **Experiment Name**: Human-readable name (e.g., "Button Color A/B Test")
   - **Variations**: Define each variation
     - **ID**: Unique identifier for the variation (e.g., "0", "1")
     - **Name**: Human-readable name (e.g., "Control", "Variant A")
     - **Value**: The actual value to use (e.g., `#CDFF00`, `#FF6B6B`)

3. Click "Create Experiment"

### Step 4: Alternatively, Create via API

You can also create experiments programmatically:

```typescript
// Using tRPC client
const result = await trpc.experiments.create.mutate({
  key: "button-color-test",
  name: "Button Color A/B Test",
  description: "Testing which button color gets more clicks",
  variations: [
    { id: "0", name: "Control", value: "#CDFF00" },
    { id: "1", name: "Variant A", value: "#FF6B6B" },
  ],
  weights: [0.5, 0.5], // 50/50 split
  coverage: 100, // Include 100% of users
  pagePath: "/home", // Optional: only show on home page
  questionId: null, // Optional: only show for specific question
});
```

Or directly via database:

```typescript
import { getDb } from "./server/db";
import { experiments } from "./drizzle/schema";

const db = await getDb();
await db.insert(experiments).values({
  key: "button-color-test",
  name: "Button Color A/B Test",
  description: "Testing which button color gets more clicks",
  variations: JSON.stringify([
    { id: "0", name: "Control", value: "#CDFF00" },
    { id: "1", name: "Variant A", value: "#FF6B6B" },
  ]),
  weights: JSON.stringify([0.5, 0.5]),
  coverage: 100,
  pagePath: "/home",
  questionId: null,
  isActive: true,
});
```

## Implementing Experiments in Code

### Method 1: Using the useFeature Hook (Recommended)

The simplest way to use experiments in your React components:

```tsx
import { useFeature } from "@/hooks/useGrowthBook";

function HomePage() {
  // Get the button color from the experiment
  const buttonColor = useFeature("button-color-test", "#CDFF00", "/home");

  return <button style={{ backgroundColor: buttonColor }}>Click Me!</button>;
}
```

### Method 2: Using the useGrowthBook Hook Directly

For more control:

```tsx
import { useGrowthBook } from "@/hooks/useGrowthBook";

function HomePage() {
  const { gb, loading } = useGrowthBook("/home");

  if (loading || !gb) {
    return <div>Loading...</div>;
  }

  const buttonColor = gb.getFeatureValue("button-color-test", "#CDFF00");

  return <button style={{ backgroundColor: buttonColor }}>Click Me!</button>;
}
```

### Method 3: Multiple Variations with Different Content

```tsx
import { useFeature } from "@/hooks/useGrowthBook";

function HomePage() {
  const welcomeMessage = useFeature(
    "welcome-message",
    {
      title: "Welcome to Spill",
      subtitle: "Share your feedback",
    },
    "/home"
  );

  return (
    <div>
      <h1>{welcomeMessage.title}</h1>
      <p>{welcomeMessage.subtitle}</p>
    </div>
  );
}
```

### Targeting Experiments

#### By Page Path

```typescript
// Create experiment for specific page
await trpc.experiments.create.mutate({
  key: 'home-headline-test',
  name: 'Home Page Headline Test',
  variations: [...],
  pagePath: '/home', // Only show on home page
});

// Use in component
const headline = useFeature('home-headline-test', 'Default', '/home');
```

#### By Question ID

```typescript
// Create experiment for specific question
await trpc.experiments.create.mutate({
  key: 'question-layout-test',
  name: 'Question Layout Test',
  variations: [...],
  questionId: 123, // Only show for question 123
});

// Use in component
const layout = useFeature('question-layout-test', 'vertical', undefined, 123);
```

## Analyzing Results

### Step 1: View Results in Admin Dashboard

1. Navigate to `/admin/experiments/results`
2. Select your experiment
3. View metrics:
   - **Exposures**: Number of unique users who saw each variation
   - **Conversions**: Number of users who completed the target action
   - **Conversion Rate**: Percentage of exposed users who converted

### Step 2: Query Results via API

```typescript
const results = await trpc.experiments.getResults.query({
  experimentKey: "button-color-test",
});

console.log(results);
// {
//   exposures: [
//     { variationId: '0', count: 523 },
//     { variationId: '1', count: 517 }
//   ],
//   conversions: [
//     { variationId: '0', count: 87 },
//     { variationId: '1', count: 104 }
//   ]
// }
```

### Step 3: Calculate Statistical Significance

Calculate conversion rates:

```typescript
function calculateConversionRate(exposures: number, conversions: number) {
  return (conversions / exposures) * 100;
}

const controlRate = calculateConversionRate(523, 87); // 16.63%
const variantRate = calculateConversionRate(517, 104); // 20.12%
```

For statistical significance, use a tool like:

- [Evan's Awesome A/B Tools](https://www.evanmiller.org/ab-testing/sample-size.html)
- [Optimizely's Stats Engine](https://www.optimizely.com/insights/blog/stats-engine/)

### Step 4: Export Raw Data

Query the database directly for detailed analysis:

```sql
-- Export all exposures for an experiment
SELECT
  ee.variationId,
  ee.deviceId,
  ee.sessionId,
  ee.exposedAt,
  r.submittedAt,
  CASE
    WHEN r.id IS NOT NULL THEN 1
    ELSE 0
  END as converted
FROM experiment_exposures ee
LEFT JOIN responses r
  ON ee.ipAddress = r.ipAddress
  AND ee.exposedAt <= r.submittedAt
WHERE ee.experimentKey = 'button-color-test'
ORDER BY ee.exposedAt DESC;
```

## Best Practices

### 1. Experiment Design

- **One variable at a time**: Test one change per experiment
- **Clear hypothesis**: Know what you're testing and why
- **Adequate sample size**: Use a sample size calculator
- **Run long enough**: Account for day-of-week effects (minimum 1-2 weeks)

### 2. Implementation

- **Default values**: Always provide sensible defaults
- **Graceful degradation**: Handle loading states and errors
- **Consistent experiences**: Users should always see the same variation

### 3. Tracking

- **Exposure tracking**: Automatically handled by GrowthBook
- **Conversion tracking**: Already implemented via response submissions
- **Clean data**: Filter out bots and invalid sessions

### 4. Analysis

- **Wait for significance**: Don't stop tests early
- **Consider external factors**: Holidays, marketing campaigns, etc.
- **Segment analysis**: Analyze by user type, time of day, etc.

### 5. Code Quality

- **Document experiments**: Comment why experiments exist
- **Clean up**: Remove old experiments after deciding
- **Version control**: Track experiment changes in git

## Troubleshooting

### Experiment Not Showing

1. **Check if experiment is active**:

   ```sql
   SELECT * FROM experiments WHERE key = 'your-experiment-key';
   ```

   Ensure `isActive = 1`

2. **Check targeting**:
   - Is `pagePath` or `questionId` set correctly?
   - Are you on the right page/question?

3. **Check coverage**:
   - If coverage < 100, some users won't see the experiment

4. **Check browser console**:
   - Look for GrowthBook logs
   - Verify config is loaded

### Exposures Not Being Tracked

1. **Check device/session IDs**:

   ```javascript
   console.log(localStorage.getItem("device_id"));
   console.log(sessionStorage.getItem("session_id"));
   ```

2. **Check network requests**:
   - Open DevTools → Network
   - Look for `trackExposure` mutation
   - Check for errors

3. **Verify database connection**:
   ```sql
   SELECT COUNT(*) FROM experiment_exposures
   WHERE experimentKey = 'your-experiment-key';
   ```

### Conversion Rates Look Wrong

1. **Check conversion logic**:
   - Conversions are based on response submissions
   - Ensure time window is correct (exposure before submission)

2. **Check for data issues**:

   ```sql
   -- Check for duplicate exposures
   SELECT deviceId, COUNT(*)
   FROM experiment_exposures
   WHERE experimentKey = 'your-experiment-key'
   GROUP BY deviceId
   HAVING COUNT(*) > 1;
   ```

3. **Verify IP address tracking**:
   - Ensure IP addresses are being captured correctly
   - Check privacy/VPN doesn't interfere

### Type Errors in TypeScript

1. **Regenerate types**:

   ```bash
   pnpm drizzle-kit generate:mysql
   ```

2. **Check imports**:
   - Ensure all types are imported correctly
   - Verify tRPC types are up to date

3. **Restart TypeScript server**:
   - VS Code: Cmd/Ctrl + Shift + P → "Restart TS Server"

## Advanced Topics

### Custom Targeting Rules

GrowthBook supports complex targeting with the `condition` field:

```typescript
await trpc.experiments.create.mutate({
  key: 'premium-feature-test',
  name: 'Premium Feature Test',
  variations: [...],
  condition: {
    // Only show to users with specific attributes
    userType: 'premium',
    country: { $in: ['US', 'CA', 'UK'] }
  }
});
```

### Multi-Armed Bandit

For automatic optimization, consider implementing a multi-armed bandit:

```typescript
// Adjust weights based on performance
const weights = calculateBanditWeights(results);
await db
  .update(experiments)
  .set({ weights: JSON.stringify(weights) })
  .where(eq(experiments.key, "button-color-test"));
```

### Feature Flags

Use experiments as feature flags by setting coverage to specific percentages:

```typescript
// Roll out to 10% of users
await trpc.experiments.create.mutate({
  key: "new-feature",
  name: "New Feature Rollout",
  variations: [
    { id: "0", name: "Off", value: false },
    { id: "1", name: "On", value: true },
  ],
  weights: [0.9, 0.1], // 90% off, 10% on
  coverage: 100,
});
```

## Resources

- [GrowthBook Documentation](https://docs.growthbook.io/)
- [A/B Testing Statistics](https://www.evanmiller.org/ab-testing/)
- [Sample Size Calculator](https://www.optimizely.com/sample-size-calculator/)
- [Bayesian A/B Testing](https://www.dynamicyield.com/lesson/bayesian-testing/)

---

**Need help?** Check the code comments in:

- `client/src/hooks/useGrowthBook.ts`
- `server/db.ts` (search for "experiment")
- `server/routers/experiments.ts`
