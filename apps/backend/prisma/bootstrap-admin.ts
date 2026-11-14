import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !username || !password || password.length < 16) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_USERNAME, and BOOTSTRAP_ADMIN_PASSWORD (minimum 16 characters).");
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    if (existing.role !== UserRole.ADMIN) {
      throw new Error("That email already belongs to a non-admin account. Refusing to elevate it automatically.");
    }
    throw new Error("An administrator with that email already exists. Use the authenticated account-management workflow instead.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { email, username, passwordHash, role: UserRole.ADMIN },
  });
  process.stdout.write(`Created the initial administrator account for ${email}. The password was not logged.\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Admin bootstrap failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
