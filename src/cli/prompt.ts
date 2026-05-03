import { createInterface } from "node:readline/promises";

/**
 * Prompt the user for a yes/no confirmation on stdin.
 *
 * Returns `true` when the user answers `y` or `yes` (case-insensitive),
 * `false` otherwise. Closes the readline interface after the response.
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(message);
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
