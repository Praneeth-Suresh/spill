import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow with role-based access control.
 * Supports three roles: user (future public access), admin (facility-specific), super_admin (all access)
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "super_admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Facilities represent physical locations or organizational units (e.g., "Oasis", "TR1", "MPSH").
 * Used to group questions and control admin access permissions.
 */
export const facilities = mysqlTable("facilities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = typeof facilities.$inferInsert;

/**
 * Junction table for many-to-many relationship between admins and facilities.
 * Super admins don't need entries here (they access everything).
 * Regular admins need explicit facility assignments to access data.
 */
export const adminFacilities = mysqlTable("admin_facilities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  facilityId: int("facilityId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"),
});

export type AdminFacility = typeof adminFacilities.$inferSelect;
export type InsertAdminFacility = typeof adminFacilities.$inferInsert;

/**
 * Questions store all question configurations with type-specific settings.
 * Supports: poll, text, fill_blanks, file_upload
 * Includes question sequencing (nextQuestionId) and branching logic support.
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  facilityId: int("facilityId").notNull(),
  type: mysqlEnum("type", ["poll", "text", "fill_blanks", "file_upload"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  placeholder: varchar("placeholder", { length: 255 }),
  isRequired: boolean("isRequired").default(true).notNull(),
  allowMultiple: boolean("allowMultiple").default(false).notNull(), // For polls: allow multiple selections
  maxFileSize: int("maxFileSize"), // For file uploads: max size in bytes
  allowedFileTypes: text("allowedFileTypes"), // For file uploads: comma-separated MIME types
  nextQuestionId: int("nextQuestionId"), // Default next question in sequence
  redirectToHome: boolean("redirectToHome").default(true).notNull(), // Redirect to home after submission
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Question options for poll-type questions.
 * Each poll can have multiple selectable options.
 */
export const questionOptions = mysqlTable("question_options", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  optionText: varchar("optionText", { length: 500 }).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionOption = typeof questionOptions.$inferSelect;
export type InsertQuestionOption = typeof questionOptions.$inferInsert;

/**
 * Responses store individual submission sessions with IP logging.
 * Each response represents one user submission event.
 * IP logging enables security analysis, rate limiting, and troubleshooting.
 */
export const responses = mysqlTable("responses", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  facilityId: int("facilityId").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(), // IPv4 or IPv6
  userAgent: text("userAgent"), // Browser/device information
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  sessionId: varchar("sessionId", { length: 64 }), // Optional session tracking
});

export type Response = typeof responses.$inferSelect;
export type InsertResponse = typeof responses.$inferInsert;

/**
 * Response answers store the actual answer content for each response.
 * Flexible structure supports all question types:
 * - Polls: optionId is populated
 * - Text/fill-blanks: textAnswer is populated
 * - File uploads: fileId is populated
 */
export const responseAnswers = mysqlTable("response_answers", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  questionId: int("questionId").notNull(),
  optionId: int("optionId"), // For poll answers
  textAnswer: text("textAnswer"), // For text/fill-in-blanks answers
  fileId: int("fileId"), // For file upload answers
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResponseAnswer = typeof responseAnswers.$inferSelect;
export type InsertResponseAnswer = typeof responseAnswers.$inferInsert;

/**
 * Uploaded files store metadata for file upload responses.
 * Actual file bytes stored in S3, not database.
 * File URLs are public but non-enumerable (random suffixes in keys).
 */
export const uploadedFiles = mysqlTable("uploaded_files", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull().unique(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = typeof uploadedFiles.$inferInsert;

/**
 * Question branching stores conditional logic for question flows.
 * Enables complex question sequencing based on user answers.
 * Rules evaluated in priority order (lower = higher priority).
 */
export const questionBranching = mysqlTable("question_branching", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("questionId").notNull(),
  optionId: int("optionId"), // Trigger option (for polls)
  condition: mysqlEnum("condition", ["option_selected", "any_answer", "no_answer"]).notNull(),
  nextQuestionId: int("nextQuestionId"), // Target question
  redirectToHome: boolean("redirectToHome").default(false).notNull(),
  priority: int("priority").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuestionBranching = typeof questionBranching.$inferSelect;
export type InsertQuestionBranching = typeof questionBranching.$inferInsert;

/**
 * Define relations for Drizzle ORM query builder
 */
export const usersRelations = relations(users, ({ many }) => ({
  adminFacilities: many(adminFacilities),
  createdQuestions: many(questions),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  adminFacilities: many(adminFacilities),
  questions: many(questions),
  responses: many(responses),
}));

export const adminFacilitiesRelations = relations(adminFacilities, ({ one }) => ({
  user: one(users, {
    fields: [adminFacilities.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [adminFacilities.facilityId],
    references: [facilities.id],
  }),
  assignedByUser: one(users, {
    fields: [adminFacilities.assignedBy],
    references: [users.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [questions.facilityId],
    references: [facilities.id],
  }),
  creator: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
  nextQuestion: one(questions, {
    fields: [questions.nextQuestionId],
    references: [questions.id],
  }),
  options: many(questionOptions),
  responses: many(responses),
  branchingRules: many(questionBranching),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one, many }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
  answers: many(responseAnswers),
}));

export const responsesRelations = relations(responses, ({ one, many }) => ({
  question: one(questions, {
    fields: [responses.questionId],
    references: [questions.id],
  }),
  facility: one(facilities, {
    fields: [responses.facilityId],
    references: [facilities.id],
  }),
  answers: many(responseAnswers),
  uploadedFiles: many(uploadedFiles),
}));

export const responseAnswersRelations = relations(responseAnswers, ({ one }) => ({
  response: one(responses, {
    fields: [responseAnswers.responseId],
    references: [responses.id],
  }),
  question: one(questions, {
    fields: [responseAnswers.questionId],
    references: [questions.id],
  }),
  option: one(questionOptions, {
    fields: [responseAnswers.optionId],
    references: [questionOptions.id],
  }),
  file: one(uploadedFiles, {
    fields: [responseAnswers.fileId],
    references: [uploadedFiles.id],
  }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  response: one(responses, {
    fields: [uploadedFiles.responseId],
    references: [responses.id],
  }),
}));

export const questionBranchingRelations = relations(questionBranching, ({ one }) => ({
  question: one(questions, {
    fields: [questionBranching.questionId],
    references: [questions.id],
  }),
  option: one(questionOptions, {
    fields: [questionBranching.optionId],
    references: [questionOptions.id],
  }),
  nextQuestion: one(questions, {
    fields: [questionBranching.nextQuestionId],
    references: [questions.id],
  }),
}));
