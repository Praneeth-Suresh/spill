import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import "dotenv/config";
import * as schema from "../drizzle/schema";

type QuestionType = "poll" | "text" | "fill_blanks" | "file_upload";

const rl = createInterface({ input, output });

async function createDb() {
	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL is not set. Please configure it in your environment.");
		process.exit(1);
	}
	const pool = mysql.createPool(process.env.DATABASE_URL);
	return { pool, db: drizzle(pool) };
}

function parseBoolean(answer: string | undefined, fallback: boolean): boolean {
	if (!answer) return fallback;
	const normalized = answer.trim().toLowerCase();
	if (["y", "yes", "true", "1"].includes(normalized)) return true;
	if (["n", "no", "false", "0"].includes(normalized)) return false;
	return fallback;
}

async function askLine(prompt: string, defaultValue?: string): Promise<string> {
	const response = (await rl.question(defaultValue ? `${prompt} (${defaultValue}) ` : `${prompt} `)).trim();
	if (response === "" && defaultValue !== undefined) return defaultValue;
	return response;
}

async function askBoolean(prompt: string, fallback: boolean): Promise<boolean> {
	const answer = await askLine(`${prompt} [y/n]`, fallback ? "y" : "n");
	return parseBoolean(answer, fallback);
}

async function askNumber(prompt: string, fallback?: number): Promise<number | null> {
	const suffix = fallback !== undefined ? ` (${fallback})` : "";
	const raw = (await rl.question(`${prompt}${suffix}: `)).trim();
	if (raw === "") {
		return fallback !== undefined ? fallback : null;
	}
	const value = Number(raw);
	if (Number.isNaN(value)) {
		console.log("Please enter a valid number.");
		return askNumber(prompt, fallback);
	}
	return value;
}

async function askRequired(prompt: string): Promise<string> {
	const value = (await rl.question(`${prompt}: `)).trim();
	if (!value) {
		console.log("This field is required.");
		return askRequired(prompt);
	}
	return value;
}

async function askQuestionType(): Promise<QuestionType> {
	const value = (await rl.question("Question type [poll/text/fill_blanks/file_upload]: ")).trim() as QuestionType;
	const allowed: QuestionType[] = ["poll", "text", "fill_blanks", "file_upload"];
	if (!allowed.includes(value)) {
		console.log("Invalid type. Choose from poll, text, fill_blanks, file_upload.");
		return askQuestionType();
	}
	return value;
}

async function collectOptions(): Promise<string[]> {
	const count = await askNumber("How many options?", 3);
	const total = count ?? 0;
	const options: string[] = [];
	for (let i = 0; i < total; i++) {
		const text = await askRequired(`Option ${i + 1} text`);
		options.push(text);
	}
	return options;
}

async function listFacilities(db: ReturnType<typeof drizzle>) {
	const facilities = await db.select().from(schema.facilities).orderBy(schema.facilities.id);
	if (facilities.length === 0) {
		console.log("No facilities found. Please add one before creating questions.");
		process.exit(1);
	}

	console.log("\nFacilities (id — name):");
	facilities.forEach((f) => {
		const suffix = f.description ? ` — ${f.description}` : "";
		console.log(`${f.id.toString().padStart(3, " ")} — ${f.name}${suffix}`);
	});

	return facilities;
}

type QuestionListItem = {
	id: number;
	facilityId: number;
	displayOrder: number;
	title: string;
};

async function fetchQuestions(db: ReturnType<typeof drizzle>): Promise<QuestionListItem[]> {
	const rows = await db
		.select({
			id: schema.questions.id,
			title: schema.questions.title,
			facilityId: schema.questions.facilityId,
			displayOrder: schema.questions.displayOrder,
		})
		.from(schema.questions)
		.orderBy(schema.questions.facilityId, schema.questions.displayOrder, schema.questions.id);
	return rows;
}

// --- Scrollable question list feature (future development) ---
// async function showScrollableQuestions(items: QuestionListItem[], windowSize = 10) {
// 	if (!items.length) {
// 		console.log("No existing questions yet.");
// 		return;
// 	}
// 	if (!process.stdin.isTTY) {
// 		console.log("Existing questions (TTY not detected, showing all):");
// 		items.forEach((q) => {
// 			console.log(`${q.id.toString().padStart(4, " ")} | facility ${q.facilityId} | order ${q.displayOrder} | ${q.title}`);
// 		});
// 		return;
// 	}
// 
// 	let start = 0;
// 	const maxStart = Math.max(0, items.length - windowSize);
// 
// 	const render = () => {
// 		process.stdout.write("\x1B[2J\x1B[0f");
// 		console.log("Use ↑/↓ or j/k to scroll, Enter or q to exit\n");
// 		const end = Math.min(start + windowSize, items.length);
// 		for (let i = start; i < end; i++) {
// 			const q = items[i];
// 			console.log(
// 				`${q.id.toString().padStart(4, " ")} | facility ${q.facilityId} | order ${q.displayOrder} | ${q.title}`
// 			);
// 		}
// 	};
// 
// 	render();
// 
// 	await new Promise<void>((resolve) => {
// 		const onData = (chunk: Buffer) => {
// 			const str = chunk.toString();
// 			if (str === "\u0003" /* ctrl+c */) {
// 				process.exit(1);
// 			}
// 			if (str === "q" || str === "\r" || str === "\n") {
// 				cleanup();
// 				return;
// 			}
// 			if (str === "\u001b[A" || str === "k") {
// 				start = Math.max(0, start - 1);
// 				render();
// 				return;
// 			}
// 			if (str === "\u001b[B" || str === "j") {
// 				start = Math.min(maxStart, start + 1);
// 				render();
// 				return;
// 			}
// 		};
// 
// 		const cleanup = () => {
// 			process.stdin.setRawMode(false);
// 			const off = (process.stdin as any).off?.bind(process.stdin) || process.stdin.removeListener.bind(process.stdin);
// 			off("data", onData);
// 			console.log("\n");
// 			resolve();
// 		};
// 
// 		process.stdin.setRawMode(true);
// 		process.stdin.on("data", onData);
// 	});
// }

async function getNextDisplayOrder(db: ReturnType<typeof drizzle>, facilityId: number): Promise<number> {
	const [row] = await db
		.select({ maxDisplay: sql<number>`coalesce(max(${schema.questions.displayOrder}), 0)` })
		.from(schema.questions)
		.where(sql`${schema.questions.facilityId} = ${facilityId}`);
	return (row?.maxDisplay ?? 0) + 1;
}

async function getNextQuestionId(pool: mysql.Pool): Promise<number | null> {
	const [rows] = await pool.query<any[]>("SHOW TABLE STATUS LIKE 'questions'");
	const next = rows?.[0]?.Auto_increment;
	return typeof next === "number" ? next : null;
}

async function main() {
	console.log("\n--- Add a new question ---\n");

	const { pool, db } = await createDb();
	const facilities = await listFacilities(db);

	const defaultFacilityId = facilities[0]?.id ?? 1;
	const facilityId = await askNumber("Facility ID", defaultFacilityId);
	const type = await askQuestionType();
	const title = await askRequired("Title");
	const description = await askLine("Description (optional)", "");
	const placeholder = type === "poll" ? null : await askLine("Placeholder (optional)", "");
	const isRequired = await askBoolean("Is the question required?", true);
	const allowMultiple = type === "poll" ? await askBoolean("Allow multiple selections?", false) : false;
	const maxFileSize = type === "file_upload" ? await askNumber("Max file size in bytes (leave blank for none)") : null;
	const allowedFileTypes = type === "file_upload" ? await askLine("Allowed file types (comma-separated, optional)", "") : "";

	const questions = await fetchQuestions(db);
	if (questions.length > 0) {
		// Scrollable question list feature is commented out for future development.
		console.log("Existing questions:");
		questions.forEach((q) => {
			console.log(`${q.id.toString().padStart(4, " ")} | facility ${q.facilityId} | order ${q.displayOrder} | ${q.title}`);
		});
	}
	const nextQuestionId = await askNumber("Next question ID (leave blank for none)");
	const redirectToHome = await askBoolean("Redirect to home after submit?", true);
	const displayOrder = await getNextDisplayOrder(db, facilityId ?? defaultFacilityId);
	const isActive = await askBoolean("Set question as active?", true);
	const pointsAwarded = await askNumber("Points awarded", 0) ?? 0;
	const options = type === "poll" ? await collectOptions() : [];
	const nextQuestionAutoId = await getNextQuestionId(pool);

	console.log("\n--- Summary ---");
	console.log(JSON.stringify({
		facilityId,
		type,
		title,
		description,
		placeholder,
		isRequired,
		allowMultiple,
		maxFileSize,
		allowedFileTypes,
		nextQuestionId,
		redirectToHome,
		displayOrder,
		isActive,
		pointsAwarded,
		options,
		nextQuestionAutoId,
	}, null, 2));

	if (nextQuestionAutoId) {
		console.log(`If inserted now, this question would likely get ID: ${nextQuestionAutoId}`);
	}

	const confirm = await askBoolean("Proceed to insert into the database?", false);
	if (!confirm) {
		console.log("Operation cancelled.");
		process.exit(0);
	}

	try {
		const [insertResult] = await db.insert(schema.questions).values({
			facilityId: facilityId ?? 1,
			type,
			title,
			description: description || null,
			placeholder: placeholder || null,
			isRequired,
			allowMultiple,
			maxFileSize: maxFileSize ?? null,
			allowedFileTypes: allowedFileTypes ? allowedFileTypes : null,
			nextQuestionId: nextQuestionId ?? null,
			redirectToHome,
			displayOrder,
			isActive,
			pointsAwarded,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const questionId = insertResult.insertId;
		console.log(`Question inserted with ID: ${questionId}`);

		if (type === "poll" && options.length > 0) {
			await db.insert(schema.questionOptions).values(
				options.map((optionText, index) => ({
					questionId,
					optionText,
					displayOrder: index + 1,
					isActive: true,
					createdAt: new Date(),
				}))
			);
			console.log(`Added ${options.length} options.`);
		}

		console.log("All done! ✅");
	} catch (error) {
		console.error("Failed to insert question:", error);
		process.exit(1);
	} finally {
		rl.close();
		await pool.end();
		process.exit(0);
	}
}

main();
