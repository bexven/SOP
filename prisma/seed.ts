/**
 * One-command, idempotent seed: `npm run db:seed`
 *
 * Creates (only if missing):
 *   - the initial team (Master Admin PIN from SEED_ADMIN_PIN; everyone else gets
 *     SEED_DEFAULT_PIN and must choose their own PIN at first sign-in)
 *   - the Settings row (rates/thresholds — review these in Settings)
 *   - SLA rows per task type
 *   - default checklist templates
 *
 * Re-running never overwrites PINs, settings or templates you've edited.
 * This is the ONLY place demo/initial data lives.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Role, TaskType } from "../src/generated/prisma/enums";
import { isValidPinFormat, isWeakPin } from "../src/lib/domain/pin";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) before seeding.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

function requirePin(name: string): string {
  const pin = process.env[name];
  if (!pin || !isValidPinFormat(pin)) throw new Error(`${name} must be set to a 4–6 digit PIN.`);
  if (isWeakPin(pin)) throw new Error(`${name} is too easy to guess (avoid repeats like 1111 and runs like 1234).`);
  return pin;
}

const TEAM: { name: string; role: Role; avatarColor: string; adminAccess?: boolean; isMaster?: boolean }[] = [
  { name: "Sk Moni", role: "ADMIN", avatarColor: "indigo", isMaster: true },
  { name: "Inamul", role: "REVIEWER", avatarColor: "violet" },
  { name: "Jewel", role: "RESEARCHER", avatarColor: "sky", adminAccess: true },
  { name: "Rony", role: "VIDEO_EDITOR", avatarColor: "rose" },
  { name: "Kamrul", role: "IMAGE_DESIGNER", avatarColor: "orange" },
  { name: "Shohag", role: "MEDIA_BUYER", avatarColor: "emerald" },
];

const BRANDS = [
  { name: "Timtom", color: "#0369A1" },
  { name: "Mr.WOW", color: "#15803D" },
];

// Starting values only — Admin should confirm them in Settings.
const DEFAULT_SETTINGS = {
  rmbToBdtRate: "17.0000",
  usdToBdtRate: "122.0000",
  courierChargePct: "2.00",
  healthyMarginPct: "30.00",
  thinMarginPct: "15.00",
};

const DEFAULT_SLA_HOURS: Record<TaskType, number> = {
  RESEARCH: 48,
  PRODUCT_APPROVAL: 24,
  WEBSITE_IMAGE: 24,
  AD_IMAGE_LANDSCAPE: 24,
  AD_IMAGE_SQUARE: 24,
  AD_IMAGE_VERTICAL: 24,
  STORE_LISTING: 24,
  VIDEO_MAIN: 48,
  VIDEO_SQUARE: 24,
  CAMPAIGN_LAUNCH: 24,
};

// From the brief. Other task types start empty; Admin adds items in Settings.
const DEFAULT_CHECKLISTS: Partial<Record<TaskType, string[]>> = {
  RESEARCH: [
    "Does the product solve a real problem?",
    "Is the customer pain point clear?",
    "Does it meet our winning-product criteria?",
  ],
};

async function seedTeam() {
  const adminPin = requirePin("SEED_ADMIN_PIN");
  const defaultPin = requirePin("SEED_DEFAULT_PIN");
  const [adminHash, defaultHash] = await Promise.all([bcrypt.hash(adminPin, 12), bcrypt.hash(defaultPin, 12)]);

  for (const person of TEAM) {
    const existing = await db.user.findFirst({
      where: { name: { equals: person.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      console.log(`  · ${person.name} already exists — left unchanged`);
      continue;
    }
    const isMaster = Boolean(person.isMaster);
    await db.user.create({
      data: {
        name: person.name,
        role: person.role,
        avatarColor: person.avatarColor,
        adminAccess: Boolean(person.adminAccess),
        isMaster,
        pinHash: isMaster ? adminHash : defaultHash,
        mustChangePin: !isMaster,
      },
    });
    console.log(`  + ${person.name} (${person.role})`);
  }
}

async function seedSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log("  · settings already exist — left unchanged");
    return;
  }
  await db.settings.create({ data: { id: 1, ...DEFAULT_SETTINGS } });
  console.log("  + settings (review rates & thresholds in Settings)");
}

async function seedTaskTypeConfig() {
  for (const [taskType, slaHours] of Object.entries(DEFAULT_SLA_HOURS) as [TaskType, number][]) {
    const res = await db.taskTypeConfig.upsert({
      where: { taskType },
      create: { taskType, slaHours },
      update: {},
    });
    console.log(`  · SLA ${taskType}: ${res.slaHours}h`);
  }
}

async function seedChecklists() {
  for (const [taskType, labels] of Object.entries(DEFAULT_CHECKLISTS) as [TaskType, string[]][]) {
    const count = await db.checklistTemplateItem.count({ where: { taskType } });
    if (count > 0) {
      console.log(`  · ${taskType} checklist already has ${count} item(s) — left unchanged`);
      continue;
    }
    await db.checklistTemplateItem.createMany({
      data: labels.map((label, order) => ({ taskType, label, order, required: true })),
    });
    console.log(`  + ${taskType} checklist (${labels.length} items)`);
  }
}

async function seedBrands() {
  for (const [order, b] of BRANDS.entries()) {
    const exists = await db.brand.findUnique({ where: { name: b.name } });
    if (exists) continue;
    await db.brand.create({ data: { ...b, order } });
    console.log(`  + brand ${b.name}`);
  }
}

async function main() {
  console.log("Seeding team…");
  await seedTeam();
  console.log("Seeding brands…");
  await seedBrands();
  console.log("Seeding settings…");
  await seedSettings();
  console.log("Seeding task SLAs…");
  await seedTaskTypeConfig();
  console.log("Seeding checklist templates…");
  await seedChecklists();
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
