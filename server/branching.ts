/**
 * Question branching logic module.
 * Determines the next question based on user answers and branching rules.
 */

import { getDb } from "./db";
import { questionBranching, questions } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

/**
 * Evaluate branching rules and determine the next question.
 * Returns the next question ID or null if should redirect to home.
 * 
 * @param questionId - Current question ID
 * @param selectedOptionIds - Array of selected option IDs (for poll questions)
 * @returns Next question ID or null for home redirect
 */
export async function evaluateNextQuestion(
  questionId: number,
  selectedOptionIds: number[] = []
): Promise<{ nextQuestionId: number | null; redirectToHome: boolean }> {
  const db = await getDb();
  if (!db) {
    return { nextQuestionId: null, redirectToHome: true };
  }

  // Get the current question
  const currentQuestion = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (currentQuestion.length === 0) {
    return { nextQuestionId: null, redirectToHome: true };
  }

  const question = currentQuestion[0];

  // Get all active branching rules for this question, ordered by priority
  const branchingRules = await db
    .select()
    .from(questionBranching)
    .where(and(
      eq(questionBranching.questionId, questionId),
      eq(questionBranching.isActive, true)
    ))
    .orderBy(asc(questionBranching.priority));

  // Evaluate rules in priority order
  for (const rule of branchingRules) {
    let conditionMet = false;

    switch (rule.condition) {
      case 'option_selected':
        // Check if the specific option was selected
        if (rule.optionId && selectedOptionIds.includes(rule.optionId)) {
          conditionMet = true;
        }
        break;

      case 'any_answer':
        // Any answer provided (for text/file questions)
        conditionMet = true;
        break;

      case 'no_answer':
        // No answer provided (shouldn't happen if validation works, but handle it)
        conditionMet = selectedOptionIds.length === 0;
        break;
    }

    // If condition is met, use this rule's redirect
    if (conditionMet) {
      return {
        nextQuestionId: rule.nextQuestionId,
        redirectToHome: rule.redirectToHome,
      };
    }
  }

  // No matching branching rule, use question's default settings
  return {
    nextQuestionId: question.nextQuestionId,
    redirectToHome: question.redirectToHome,
  };
}

/**
 * Create a branching rule for a question.
 * 
 * @param questionId - Source question ID
 * @param condition - Trigger condition
 * @param nextQuestionId - Target question ID (null for home redirect)
 * @param redirectToHome - Whether to redirect to home
 * @param optionId - Option ID for option_selected condition
 * @param priority - Rule priority (lower = higher priority)
 */
export async function createBranchingRule(
  questionId: number,
  condition: 'option_selected' | 'any_answer' | 'no_answer',
  nextQuestionId: number | null,
  redirectToHome: boolean,
  optionId?: number,
  priority: number = 0
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(questionBranching).values({
    questionId,
    condition,
    nextQuestionId,
    redirectToHome,
    optionId: optionId || null,
    priority,
    isActive: true,
  });
}

/**
 * Update a question's default next question and redirect settings.
 * 
 * @param questionId - Question ID to update
 * @param nextQuestionId - Default next question ID
 * @param redirectToHome - Whether to redirect to home by default
 */
export async function updateQuestionSequence(
  questionId: number,
  nextQuestionId: number | null,
  redirectToHome: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(questions)
    .set({
      nextQuestionId,
      redirectToHome,
      updatedAt: new Date(),
    })
    .where(eq(questions.id, questionId));
}
