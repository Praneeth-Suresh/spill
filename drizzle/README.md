# Spill Database Schema

This document captures the full relational model that backs Spill's survey, experiment, and points systems. All tables are defined with Drizzle ORM for MySQL and live in `drizzle/schema.ts`.

## Entity Overview

- **users**: Auth identities with role-based access control and points balance.
- **facilities**: Physical locations or business units used to scope content and permissions.
- **admin_facilities**: Junction table linking admins to the facilities they can manage.
- **questions**: Core survey questions with branching and display metadata.
- **question_options**: Multiple-choice options for poll questions.
- **responses**: Individual submission sessions, including device fingerprinting data.
- **response_answers**: Normalized answer records for every question in a response session.
- **uploaded_files**: Metadata for file-upload answers, referencing S3 objects.
- **question_branching**: Conditional routing rules between questions.
- **points**: Anonymous point balances keyed by normalized IP.
- **ip_addresses**: Access-tracking data to gate the updates page.
- **updates**: Content feed surfaced on the updates page.
- **experiments**: GrowthBook-compatible experiment definitions.
- **experiment_exposures**: Analytics log describing which variation a visitor saw.

## Table Reference

### users

| Column       | Type                           | Constraints                     | Notes                                    |
| ------------ | ------------------------------ | ------------------------------- | ---------------------------------------- |
| id           | int                            | PK, auto increment              | Surrogate key                            |
| openId       | varchar(64)                    | NOT NULL, UNIQUE                | OAuth/OpenID subject identifier          |
| name         | text                           | nullable                        | Display name, can be blank               |
| email        | varchar(320)                   | nullable                        | Used for notifications and admin lookup  |
| loginMethod  | varchar(64)                    | nullable                        | Provider descriptor (google, okta, etc.) |
| role         | enum(user, admin, super_admin) | NOT NULL, default user          | Governs access scope                     |
| points       | int                            | NOT NULL, default 0             | Aggregate points for logged-in users     |
| createdAt    | timestamp                      | NOT NULL, default now           | Creation audit                           |
| updatedAt    | timestamp                      | NOT NULL, default now/on update | Mutation audit                           |
| lastSignedIn | timestamp                      | NOT NULL, default now           | Last successful login                    |

### facilities

| Column      | Type         | Constraints                     | Notes                            |
| ----------- | ------------ | ------------------------------- | -------------------------------- |
| id          | int          | PK, auto increment              |                                  |
| name        | varchar(255) | NOT NULL, UNIQUE                | Human-friendly name              |
| code        | varchar(50)  | NOT NULL, UNIQUE                | Short identifier used in the UI  |
| description | text         | nullable                        | Optional overview                |
| isActive    | boolean      | NOT NULL, default true          | Disable to hide facility content |
| createdAt   | timestamp    | NOT NULL, default now           |                                  |
| updatedAt   | timestamp    | NOT NULL, default now/on update |                                  |

### admin_facilities

| Column     | Type      | Constraints                  | Notes                          |
| ---------- | --------- | ---------------------------- | ------------------------------ |
| id         | int       | PK, auto increment           |                                |
| userId     | int       | NOT NULL, FK → users.id      | Admin being granted access     |
| facilityId | int       | NOT NULL, FK → facilities.id | Facility scope                 |
| assignedAt | timestamp | NOT NULL, default now        | Audit stamp                    |
| assignedBy | int       | FK → users.id                | Super admin who granted access |

### questions

| Column           | Type                                       | Constraints                     | Notes                              |
| ---------------- | ------------------------------------------ | ------------------------------- | ---------------------------------- |
| id               | int                                        | PK, auto increment              |                                    |
| facilityId       | int                                        | NOT NULL, FK → facilities.id    | Facility ownership                 |
| type             | enum(poll, text, fill_blanks, file_upload) | NOT NULL                        | Determines answer UI               |
| title            | varchar(500)                               | NOT NULL                        | Question prompt                    |
| description      | text                                       | nullable                        | Rich description/supporting text   |
| placeholder      | varchar(255)                               | nullable                        | Input hint                         |
| isRequired       | boolean                                    | NOT NULL, default true          | Controls validation                |
| allowMultiple    | boolean                                    | NOT NULL, default false         | Poll-only multi select toggle      |
| maxFileSize      | int                                        | nullable                        | File upload size limit (bytes)     |
| allowedFileTypes | text                                       | nullable                        | Comma-delimited MIME whitelist     |
| nextQuestionId   | int                                        | FK → questions.id               | Default sequencing fallback        |
| redirectToHome   | boolean                                    | NOT NULL, default true          | Whether completion returns to home |
| displayOrder     | int                                        | NOT NULL, default 0             | Ordering within facility           |
| isActive         | boolean                                    | NOT NULL, default true          | Soft delete flag                   |
| pointsAwarded    | int                                        | NOT NULL, default 0             | Points gained per response         |
| createdAt        | timestamp                                  | NOT NULL, default now           |                                    |
| updatedAt        | timestamp                                  | NOT NULL, default now/on update |                                    |
| createdBy        | int                                        | FK → users.id                   | Admin author                       |

### question_options

| Column       | Type         | Constraints                 | Notes         |
| ------------ | ------------ | --------------------------- | ------------- |
| id           | int          | PK, auto increment          |               |
| questionId   | int          | NOT NULL, FK → questions.id | Owning poll   |
| optionText   | varchar(500) | NOT NULL                    | Display label |
| displayOrder | int          | NOT NULL, default 0         | Render order  |
| isActive     | boolean      | NOT NULL, default true      | Soft delete   |
| createdAt    | timestamp    | NOT NULL, default now       |               |

### responses

| Column      | Type        | Constraints                  | Notes                                |
| ----------- | ----------- | ---------------------------- | ------------------------------------ |
| id          | int         | PK, auto increment           |                                      |
| questionId  | int         | NOT NULL, FK → questions.id  | Question answered in this submission |
| facilityId  | int         | NOT NULL, FK → facilities.id | Facility context                     |
| ipAddress   | varchar(45) | NOT NULL                     | Normalized IPv4/v6 string            |
| userAgent   | text        | nullable                     | Browser fingerprint                  |
| submittedAt | timestamp   | NOT NULL, default now        | Submission timestamp                 |
| sessionId   | varchar(64) | nullable                     | Client session tracking              |

### response_answers

| Column     | Type      | Constraints                 | Notes                      |
| ---------- | --------- | --------------------------- | -------------------------- |
| id         | int       | PK, auto increment          |                            |
| responseId | int       | NOT NULL, FK → responses.id | Parent submission          |
| questionId | int       | NOT NULL, FK → questions.id | Question being answered    |
| optionId   | int       | FK → question_options.id    | Populated for poll answers |
| textAnswer | text      | nullable                    | Free-form response content |
| fileId     | int       | FK → uploaded_files.id      | File upload reference      |
| createdAt  | timestamp | NOT NULL, default now       |                            |

### uploaded_files

| Column     | Type         | Constraints                 | Notes                    |
| ---------- | ------------ | --------------------------- | ------------------------ |
| id         | int          | PK, auto increment          |                          |
| responseId | int          | NOT NULL, FK → responses.id | Submission owner         |
| fileName   | varchar(255) | NOT NULL                    | Original filename        |
| fileKey    | varchar(500) | NOT NULL, UNIQUE            | Storage key (S3 object)  |
| fileUrl    | text         | NOT NULL                    | Pre-signed or public URL |
| mimeType   | varchar(100) | NOT NULL                    | MIME type                |
| fileSize   | int          | NOT NULL                    | Bytes                    |
| uploadedAt | timestamp    | NOT NULL, default now       |                          |

### question_branching

| Column         | Type                                         | Constraints                 | Notes                       |
| -------------- | -------------------------------------------- | --------------------------- | --------------------------- |
| id             | int                                          | PK, auto increment          |                             |
| questionId     | int                                          | NOT NULL, FK → questions.id | Source question             |
| optionId       | int                                          | FK → question_options.id    | Trigger option for polls    |
| condition      | enum(option_selected, any_answer, no_answer) | NOT NULL                    | Branching rule              |
| nextQuestionId | int                                          | FK → questions.id           | Target question             |
| redirectToHome | boolean                                      | NOT NULL, default false     | Allows immediate exit       |
| priority       | int                                          | NOT NULL, default 0         | Lower value evaluated first |
| isActive       | boolean                                      | NOT NULL, default true      | Rule toggle                 |
| createdAt      | timestamp                                    | NOT NULL, default now       |                             |

### points

| Column    | Type        | Constraints                     | Notes              |
| --------- | ----------- | ------------------------------- | ------------------ |
| id        | int         | PK, auto increment              |                    |
| ipAddress | varchar(45) | NOT NULL, UNIQUE                | IPv6-mapped key    |
| points    | int         | NOT NULL, default 0             | Accumulated points |
| createdAt | timestamp   | NOT NULL, default now           |                    |
| updatedAt | timestamp   | NOT NULL, default now/on update |                    |

### ip_addresses

| Column    | Type        | Constraints                     | Notes                           |
| --------- | ----------- | ------------------------------- | ------------------------------- |
| id        | int         | PK, auto increment              |                                 |
| ipAddress | varchar(45) | NOT NULL, UNIQUE                | Visitor identifier              |
| createdAt | timestamp   | NOT NULL, default now           | Used for first-seen gating      |
| updatedAt | timestamp   | NOT NULL, default now/on update | Refreshed after each submission |

### updates

| Column    | Type         | Constraints                     | Notes                               |
| --------- | ------------ | ------------------------------- | ----------------------------------- |
| id        | int          | PK, auto increment              |                                     |
| date      | timestamp    | NOT NULL, default now           | Display date                        |
| person    | varchar(255) | NOT NULL                        | Author                              |
| content   | text         | NOT NULL                        | Double-newline-delimited paragraphs |
| relevance | int          | NOT NULL, default 0             | Sorting weight                      |
| createdAt | timestamp    | NOT NULL, default now           |                                     |
| updatedAt | timestamp    | NOT NULL, default now/on update |                                     |

### experiments

| Column      | Type         | Constraints                     | Notes                                          |
| ----------- | ------------ | ------------------------------- | ---------------------------------------------- |
| id          | int          | PK, auto increment              |                                                |
| key         | varchar(100) | NOT NULL, UNIQUE                | Identifier consumed by SDK and GrowthBook      |
| name        | varchar(255) | NOT NULL                        | Human-readable label                           |
| description | text         | nullable                        | Experiment context                             |
| isActive    | boolean      | NOT NULL, default true          | High-level toggle                              |
| variations  | json         | NOT NULL                        | Array of variation definitions {id,name,value} |
| weights     | json         | nullable                        | Optional distribution list                     |
| coverage    | int          | nullable, default 100           | Percentage of users included                   |
| condition   | json         | nullable                        | Targeting logic blob                           |
| pagePath    | varchar(255) | nullable                        | Path-limiting rule                             |
| questionId  | int          | FK → questions.id               | Question-specific targeting                    |
| createdAt   | timestamp    | NOT NULL, default now           |                                                |
| updatedAt   | timestamp    | NOT NULL, default now/on update |                                                |

### experiment_exposures

| Column        | Type         | Constraints           | Notes                          |
| ------------- | ------------ | --------------------- | ------------------------------ |
| id            | int          | PK, auto increment    |                                |
| deviceId      | varchar(64)  | NOT NULL              | Stable client identifier       |
| sessionId     | varchar(64)  | NOT NULL              | Session token                  |
| experimentKey | varchar(100) | NOT NULL              | FK (logical) → experiments.key |
| variationId   | varchar(50)  | NOT NULL              | Variation identifier           |
| pagePath      | varchar(255) | nullable              | Page where exposure happened   |
| questionId    | int          | FK → questions.id     | Question context               |
| ipAddress     | varchar(45)  | nullable              | IP snapshot                    |
| userAgent     | text         | nullable              | Browser metadata               |
| exposedAt     | timestamp    | NOT NULL, default now | Exposure timestamp             |

## Relationships

- A `user` can create many `questions` and can be assigned to many `facilities` through `admin_facilities`.
- A `facility` owns many `questions` and receives many `responses`.
- Each `question` can have many `question_options`, `responses`, and `question_branching` entries, plus an optional `nextQuestionId` self-reference.
- `responses` belong to both a `question` and a `facility`, and fan out to many `response_answers` and `uploaded_files`.
- `response_answers` may point to a `question_option` (for polls) or an `uploaded_file` (for file submissions).
- `question_branching` rules connect a source `question` (and optional `question_option`) to a destination `question`.
- `experiments` optionally reference `questions`, while `experiment_exposures` log per-session impressions and can backfill analytics by joining on experiment key and question id.

## Notes

- All timestamps are stored in UTC using MySQL `timestamp` columns with `DEFAULT CURRENT_TIMESTAMP` and `ON UPDATE CURRENT_TIMESTAMP` where needed.
- Boolean values use MySQL `tinyint(1)` under the hood; Drizzle handles casting to booleans at the ORM layer.
- JSON columns (`variations`, `weights`, `condition`) should contain valid JSON structures compatible with GrowthBook's SDK expectations.
