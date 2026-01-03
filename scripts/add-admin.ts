import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import "dotenv/config";
import * as schema from "../drizzle/schema";

type RoleChoice = "admin" | "super_admin";

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

export function normalizeRoleInput(raw: string | undefined): RoleChoice {
	const value = (raw ?? "").trim().toLowerCase();
	if (value === "" || value === "admin") return "admin";
	if (["super", "super_admin", "super-admin"].includes(value)) return "super_admin";
	throw new Error("Invalid role. Choose admin or super_admin.");
}

async function askRole(): Promise<RoleChoice> {
	const raw = await askLine("Role [admin/super_admin]", "admin");
	try {
		return normalizeRoleInput(raw);
	} catch (error) {
		console.log((error as Error).message);
		return askRole();
	}
}

export function normalizeEmail(email: string): string {
	const value = email.trim().toLowerCase();
	if (!value || !value.includes("@")) {
		throw new Error("Please enter a valid email address.");
	}
	return value;
}

async function askEmail(): Promise<string> {
	const raw = await askLine("Email address");
	try {
		return normalizeEmail(raw);
	} catch (error) {
		console.log((error as Error).message);
		return askEmail();
	}
}

async function listFacilities(db: ReturnType<typeof drizzle>) {
	const facilities = await db.select().from(schema.facilities).orderBy(schema.facilities.id);
	if (facilities.length === 0) {
		console.log("No facilities found. Please add one before assigning admins.");
		process.exit(1);
	}

	console.log("\nFacilities (id — name):");
	facilities.forEach((f) => {
		const suffix = f.description ? ` — ${f.description}` : "";
		console.log(`${f.id.toString().padStart(3, " ")} — ${f.name}${suffix}`);
	});

	return facilities;
}

export function parseFacilitySelection(inputValue: string, validIds: number[]): number[] {
	const tokens = inputValue
		.split(/[\s,]+/)
		.map((t) => t.trim())
		.filter(Boolean);

	if (tokens.length === 0) {
		throw new Error("Please enter at least one facility id.");
	}

	const ids = Array.from(new Set(tokens.map((t) => Number(t))));
	if (ids.some((id) => Number.isNaN(id))) {
		throw new Error("Facility ids must be numbers.");
	}

	const invalid = ids.filter((id) => !validIds.includes(id));
	if (invalid.length > 0) {
		throw new Error(`Invalid facility ids: ${invalid.join(", ")}`);
	}

	return ids;
}

async function askFacilities(validFacilities: Array<{ id: number; name: string }>): Promise<number[]> {
	const raw = await askLine("Enter facility ids (space or comma separated)");
	try {
		return parseFacilitySelection(raw, validFacilities.map((f) => f.id));
	} catch (error) {
		console.log((error as Error).message);
		return askFacilities(validFacilities);
	}
}

export function generateOpenId(): string {
	const randomPart = randomBytes(6).toString("hex");
	const candidate = `admin-script-${Date.now()}-${randomPart}`;
	return candidate.slice(0, 64);
}

async function main() {
	console.log("\n--- Add an admin / super-admin ---\n");

	const { pool, db } = await createDb();
	const role = await askRole();
	const email = await askEmail();

	let selectedFacilities: number[] = [];
	let facilitiesById: Map<number, { id: number; name: string }> = new Map();

	if (role === "admin") {
		const facilities = await listFacilities(db);
		facilitiesById = new Map(facilities.map((f) => [f.id, f]));
		selectedFacilities = await askFacilities(facilities);
	}

	console.log("\n--- Summary ---");
	console.log(`Role: ${role}`);
	console.log(`Email: ${email}`);
	if (role === "admin") {
		const names = selectedFacilities.map((id) => facilitiesById.get(id)?.name ?? id).join(", ");
		console.log(`Facilities: ${names}`);
	} else {
		console.log("Facilities: all (super_admin)");
	}

	const confirm = await askBoolean("Proceed with these settings?", true);
	if (!confirm) {
		console.log("Operation cancelled.");
		rl.close();
		await pool.end();
		process.exit(0);
	}

	try {
		const now = new Date();
		const [existing] = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, email))
			.limit(1);

		let userId: number;

		if (existing) {
			await db
				.update(schema.users)
				.set({ role, updatedAt: now })
				.where(eq(schema.users.id, existing.id));
			userId = existing.id;
			console.log(`Updated existing user ${email} to role ${role}.`);
		} else {
			const [insertResult] = await db.insert(schema.users).values({
				openId: generateOpenId(),
				name: "Yet to register",
				email,
				loginMethod: "pending",
				role,
				points: 0,
				createdAt: now,
				updatedAt: now,
				lastSignedIn: now,
			});
			userId = insertResult.insertId;
			console.log(`Created new user ${email} with role ${role} (id ${userId}).`);
		}

		if (role === "admin" && selectedFacilities.length > 0) {
			const existingLinks = await db
				.select({ facilityId: schema.adminFacilities.facilityId })
				.from(schema.adminFacilities)
				.where(eq(schema.adminFacilities.userId, userId));
			const existingIds = new Set(existingLinks.map((r) => r.facilityId));
			const missing = selectedFacilities.filter((id) => !existingIds.has(id));

			if (missing.length > 0) {
				await db.insert(schema.adminFacilities).values(
					missing.map((facilityId) => ({
						userId,
						facilityId,
						assignedAt: now,
						assignedBy: null,
					}))
				);
				console.log(`Linked user to facilities: ${missing.join(", ")}`);
			} else {
				console.log("No new facility links needed.");
			}
		}

		console.log("All done! ✅");
	} catch (error) {
		console.error("Failed to add admin:", error);
		process.exitCode = 1;
	} finally {
		rl.close();
		await pool.end();
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main();
}
