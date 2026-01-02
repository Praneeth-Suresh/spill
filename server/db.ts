import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  facilities,
  questions,
  questionOptions,
  responses,
  responseAnswers,
  uploadedFiles,
  adminFacilities,
  questionBranching,
  points,
  ipAddresses,
  updates,
  type Facility,
  type Question,
  type QuestionOption,
  type Response,
  type ResponseAnswer,
  type AdminFacility,
  type Update,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Ensure MySQL connections allow multiple statements so multi-statement migrations work.
function ensureMultiStatements(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("multipleStatements")) {
      u.searchParams.set("multipleStatements", "true");
    }
    return u.toString();
  } catch (err) {
    console.warn("[Database] Invalid DATABASE_URL, using as-is", err);
    return url;
  }
}

/**
 * Lazily create the drizzle instance so local tooling can run without a DB.
 * Returns null if DATABASE_URL is not configured.
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = ensureMultiStatements(process.env.DATABASE_URL);
      _db = drizzle(url);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Fetch points for a normalized IP address.
 */
export async function getPointsByIp(ipAddress: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(points).where(eq(points.ipAddress, ipAddress)).limit(1);
  return result[0] ?? null;
}

/**
 * Increment points for an IP address, inserting when absent.
 */
export async function incrementPointsByIp(ipAddress: string, delta: number) {
  const db = await getDb();
  if (!db) return;

  await db.insert(points).values({
    ipAddress,
    points: delta,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      points: sql`${points.points} + ${delta}`,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert IP activity for session gating.
 */
export async function recordIpActivity(ipAddress: string) {
  const db = await getDb();
  if (!db) return;

  const now = new Date();

  await db.insert(ipAddresses).values({
    ipAddress,
    createdAt: now,
    updatedAt: now,
  }).onDuplicateKeyUpdate({
    set: { updatedAt: now },
  });
}

/**
 * Check if IP has activity today (local server time start-of-day).
 */
export async function hasIpActivityToday(ipAddress: string, now: Date = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({ exists: sql`1` })
    .from(ipAddresses)
    .where(and(eq(ipAddresses.ipAddress, ipAddress), gte(ipAddresses.updatedAt, startOfDay)))
    .limit(1);

  return result.length > 0;
}

/**
 * Increment points for a user by userId.
 */
export async function incrementUserPoints(userId: number, delta: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({ points: sql`${users.points} + ${delta}`, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Upsert user from OAuth callback.
 * Updates existing user or creates new one based on openId.
 * Automatically assigns super_admin role to owner.
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    
    // Assign role: super_admin for owner, otherwise use provided role or default to 'user'
    if (user.openId === ENV.ownerOpenId) {
      values.role = 'super_admin';
      updateSet.role = 'super_admin';
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all facilities accessible to a user based on their role.
 * Super admins get all facilities, regular admins get assigned facilities only.
 */
export async function getUserFacilities(userId: number, role: string): Promise<Facility[]> {
  const db = await getDb();
  if (!db) return [];

  // Super admins see all facilities
  if (role === 'super_admin') {
    return await db.select().from(facilities).where(eq(facilities.isActive, true)).orderBy(facilities.name);
  }

  // Regular admins see only assigned facilities
  const assignments = await db
    .select({ facility: facilities })
    .from(adminFacilities)
    .innerJoin(facilities, eq(adminFacilities.facilityId, facilities.id))
    .where(and(
      eq(adminFacilities.userId, userId),
      eq(facilities.isActive, true)
    ))
    .orderBy(facilities.name);

  return assignments.map(a => a.facility);
}

/**
 * Get all active facilities (for public question display).
 */
export async function getAllActiveFacilities(): Promise<Facility[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(facilities).where(eq(facilities.isActive, true)).orderBy(facilities.name);
}

/**
 * Get a question by ID with its options (for polls).
 */
export async function getQuestionById(questionId: number): Promise<{ question: Question; options: QuestionOption[] } | null> {
  const db = await getDb();
  if (!db) return null;

  const questionResult = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (questionResult.length === 0) return null;

  const question = questionResult[0];
  const options = await db
    .select()
    .from(questionOptions)
    .where(and(
      eq(questionOptions.questionId, questionId),
      eq(questionOptions.isActive, true)
    ))
    .orderBy(questionOptions.displayOrder);

  return { question, options };
}

/**
 * Get all active questions for a facility.
 */
export async function getQuestionsByFacility(facilityId: number): Promise<Question[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(questions)
    .where(and(
      eq(questions.facilityId, facilityId),
      eq(questions.isActive, true)
    ))
    .orderBy(questions.displayOrder);
}

/**
 * Submit a response with answers.
 * Returns the created response ID.
 */
export async function submitResponse(
  questionId: number,
  facilityId: number,
  ipAddress: string,
  userAgent: string | null,
  answers: Array<{ optionId?: number; textAnswer?: string; fileId?: number }>
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create response record
  const [response] = await db.insert(responses).values({
    questionId,
    facilityId,
    ipAddress,
    userAgent: userAgent || null,
    submittedAt: new Date(),
  });

  const responseId = response.insertId;

  // Create answer records
  for (const answer of answers) {
    await db.insert(responseAnswers).values({
      responseId,
      questionId,
      optionId: answer.optionId || null,
      textAnswer: answer.textAnswer || null,
      fileId: answer.fileId || null,
    });
  }

  return responseId;
}

/**
 * Get response statistics for a question.
 * Returns total count and breakdown by option (for polls).
 */
export async function getQuestionStats(questionId: number): Promise<{
  totalResponses: number;
  optionStats: Array<{ optionId: number; optionText: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) return { totalResponses: 0, optionStats: [] };

  // Get total responses
  const totalResult = await db
    .select({ count: sql<number>`count(distinct ${responses.id})` })
    .from(responses)
    .where(eq(responses.questionId, questionId));

  const totalResponses = totalResult[0]?.count || 0;

  // Get option statistics
  const optionStatsResult = await db
    .select({
      optionId: responseAnswers.optionId,
      optionText: questionOptions.optionText,
      count: sql<number>`count(*)`,
    })
    .from(responseAnswers)
    .innerJoin(questionOptions, eq(responseAnswers.optionId, questionOptions.id))
    .where(eq(responseAnswers.questionId, questionId))
    .groupBy(responseAnswers.optionId, questionOptions.optionText);

  const optionStats = optionStatsResult.map(stat => ({
    optionId: stat.optionId!,
    optionText: stat.optionText,
    count: stat.count,
  }));

  return { totalResponses, optionStats };
}

/**
 * Get recent text responses for a question.
 * Used for displaying feedback on admin dashboard.
 */
export async function getRecentTextResponses(questionId: number, limit: number = 10): Promise<Array<{
  id: number;
  textAnswer: string;
  submittedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: responseAnswers.id,
      textAnswer: responseAnswers.textAnswer,
      submittedAt: responses.submittedAt,
    })
    .from(responseAnswers)
    .innerJoin(responses, eq(responseAnswers.responseId, responses.id))
    .where(and(
      eq(responseAnswers.questionId, questionId),
      sql`${responseAnswers.textAnswer} IS NOT NULL`
    ))
    .orderBy(desc(responses.submittedAt))
    .limit(limit);

  return result.map(r => ({
    id: r.id,
    textAnswer: r.textAnswer!,
    submittedAt: r.submittedAt,
  }));
}

/**
 * Get facility statistics for admin dashboard.
 * Returns response counts and top problems.
 */
export async function getFacilityStats(facilityId: number, timeRange: 'week' | 'month' | 'all' = 'week'): Promise<{
  totalResponses: number;
  topProblems: Array<{ problem: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) return { totalResponses: 0, topProblems: [] };

  // Calculate date threshold
  let dateThreshold: Date | null = null;
  if (timeRange === 'week') {
    dateThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === 'month') {
    dateThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get total responses
  const whereConditions = [eq(responses.facilityId, facilityId)];
  if (dateThreshold) {
    whereConditions.push(sql`${responses.submittedAt} >= ${dateThreshold}`);
  }

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(responses)
    .where(and(...whereConditions));

  const totalResponses = totalResult[0]?.count || 0;

  // Get top problems from text responses
  const problemsResult = await db
    .select({
      problem: responseAnswers.textAnswer,
      count: sql<number>`count(*)`,
    })
    .from(responseAnswers)
    .innerJoin(responses, eq(responseAnswers.responseId, responses.id))
    .where(and(
      eq(responses.facilityId, facilityId),
      sql`${responseAnswers.textAnswer} IS NOT NULL`,
      ...(dateThreshold ? [sql`${responses.submittedAt} >= ${dateThreshold}`] : [])
    ))
    .groupBy(responseAnswers.textAnswer)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const topProblems = problemsResult.map(p => ({
    problem: p.problem!,
    count: p.count,
  }));

  return { totalResponses, topProblems };
}

/**
 * Assign an admin to a facility.
 * Only super admins can make assignments.
 */
export async function assignAdminToFacility(userId: number, facilityId: number, assignedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(adminFacilities).values({
    userId,
    facilityId,
    assignedBy,
    assignedAt: new Date(),
  });
}

/**
 * Get all admin assignments for a facility.
 */
export async function getFacilityAdmins(facilityId: number): Promise<Array<{
  userId: number;
  userName: string | null;
  userEmail: string | null;
  assignedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      assignedAt: adminFacilities.assignedAt,
    })
    .from(adminFacilities)
    .innerJoin(users, eq(adminFacilities.userId, users.id))
    .where(eq(adminFacilities.facilityId, facilityId))
    .orderBy(adminFacilities.assignedAt);

  return result;
}

/**
 * Export responses as structured data for CSV/JSON export.
 */
export async function exportResponses(
  facilityIds: number[],
  startDate?: Date,
  endDate?: Date
): Promise<Array<{
  responseId: number;
  facilityName: string;
  questionTitle: string;
  questionType: string;
  answer: string;
  ipAddress: string;
  submittedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  const whereConditions = [inArray(responses.facilityId, facilityIds)];
  if (startDate) {
    whereConditions.push(sql`${responses.submittedAt} >= ${startDate}`);
  }
  if (endDate) {
    whereConditions.push(sql`${responses.submittedAt} <= ${endDate}`);
  }

  const result = await db
    .select({
      responseId: responses.id,
      facilityName: facilities.name,
      questionTitle: questions.title,
      questionType: questions.type,
      optionText: questionOptions.optionText,
      textAnswer: responseAnswers.textAnswer,
      ipAddress: responses.ipAddress,
      submittedAt: responses.submittedAt,
    })
    .from(responses)
    .innerJoin(facilities, eq(responses.facilityId, facilities.id))
    .innerJoin(questions, eq(responses.questionId, questions.id))
    .innerJoin(responseAnswers, eq(responses.id, responseAnswers.responseId))
    .leftJoin(questionOptions, eq(responseAnswers.optionId, questionOptions.id))
    .where(and(...whereConditions))
    .orderBy(desc(responses.submittedAt));

  return result.map(r => ({
    responseId: r.responseId,
    facilityName: r.facilityName,
    questionTitle: r.questionTitle,
    questionType: r.questionType,
    answer: r.optionText || r.textAnswer || '',
    ipAddress: r.ipAddress,
    submittedAt: r.submittedAt,
  }));
}

/**
 * Fetch top updates ordered by relevance then most recent date.
 */
export async function getLatestUpdates(limit: number = 3): Promise<Update[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(updates)
    .orderBy(desc(updates.date), desc(updates.id))
    .limit(limit);
}

export async function getUpdatesByQuestion(questionId: number, limit: number = 5): Promise<Update[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(updates)
    .where(eq(updates.relevance, questionId))
    .orderBy(desc(updates.date), desc(updates.id))
    .limit(limit);
}

/**
 * Legacy helper retained for compatibility. Delegates to getLatestUpdates
 * now that `relevance` is repurposed as questionId.
 */
export async function getTopUpdates(limit: number = 3): Promise<Update[]> {
  return getLatestUpdates(limit);
}
