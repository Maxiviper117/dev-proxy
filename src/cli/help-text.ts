import chalk from "chalk";

const bannerLines = [
  "██████╗ ███████╗██╗   ██╗██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗",
  "██╔══██╗██╔════╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝",
  "██║  ██║█████╗  ██║   ██║██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ ",
  "██║  ██║██╔══╝  ╚██╗ ██╔╝██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  ",
  "██████╔╝███████╗ ╚████╔╝ ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║   ",
  "╚═════╝ ╚══════╝  ╚═══╝  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ",
] as const;

const bannerPalette = ["#00c2ff", "#3f8cff", "#7c5cff", "#c44dff", "#ff5ca8", "#ff8a5b"] as const;

/**
 * Render the branded CLI banner using chalk.
 */
export function renderBanner(): string {
  const lines = bannerLines.map((line, index) => {
    const color = bannerPalette[index] ?? "#ff8a5b";
    return chalk.hex(color).bold(line);
  });

  lines.push(chalk.cyan("Stable HTTPS local domains for local development."));
  // Add trailing blank line to match Ink marginBottom={1}
  lines.push("");

  return lines.join("\n");
}

/**
 * Render a dimmed CLI version line.
 */
export function renderVersionLine(version: string): string {
  return chalk.dim(`Version ${version}`);
}
