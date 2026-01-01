import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { drizzle } from "drizzle-orm/mysql2";
import "dotenv/config";
import * as schema from "../drizzle/schema";

type QuestionType = "poll" | "text" | "fill_blanks" | "file_upload";

const rl = createInterface({ input, output });

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

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL is not set. Please configure it in your environment.");
		process.exit(1);
	}

	console.log("\n--- Add a new question ---\n");

	const facilityId = await askNumber("Facility ID", 1);
	const type = await askQuestionType();
	const title = await askRequired("Title");
	const description = await askLine("Description (optional)", "");
	const placeholder = type === "poll" ? null : await askLine("Placeholder (optional)", "");
	const isRequired = await askBoolean("Is the question required?", true);
	const allowMultiple = type === "poll" ? await askBoolean("Allow multiple selections?", false) : false;
	const maxFileSize = type === "file_upload" ? await askNumber("Max file size in bytes (leave blank for none)") : null;
	const allowedFileTypes = type === "file_upload" ? await askLine("Allowed file types (comma-separated, optional)", "") : "";
	const nextQuestionId = await askNumber("Next question ID (leave blank for none)");
	const redirectToHome = await askBoolean("Redirect to home after submit?", true);
	const displayOrder = await askNumber("Display order", 0) ?? 0;
	const isActive = await askBoolean("Set question as active?", true);
	const pointsAwarded = await askNumber("Points awarded", 0) ?? 0;
	const options = type === "poll" ? await collectOptions() : [];

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
	}, null, 2));

	const confirm = await askBoolean("Proceed to insert into the database?", false);
	if (!confirm) {
		console.log("Operation cancelled.");
		process.exit(0);
	}

	const db = drizzle(process.env.DATABASE_URL);

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
	}
}

main();
