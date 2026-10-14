import bcrypt from "bcryptjs";

const COST = 12;

export const PASSWORD_MIN_LENGTH = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A valid hash used to equalise timing when a user does not exist.
let dummyHash: string | null = null;
export async function dummyVerify(password: string) {
  dummyHash ??= await bcrypt.hash("timing-equaliser-not-a-password", COST);
  await bcrypt.compare(password, dummyHash);
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  if (password.length > 200) problems.push("Use at most 200 characters");
  if (!/[a-zA-Z]/.test(password) || !/[0-9\W_]/.test(password))
    problems.push("Use a mix of letters and numbers or symbols");
  return problems;
}
