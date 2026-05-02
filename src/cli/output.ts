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
 * Return the ANSI-colored DevProxy ASCII banner.
 *
 * Maps each banner line to a color from a gradient palette using `chalk`.
 */
export function formatBanner(): string {
  return bannerLines
    .map((line, index) => {
      const color = bannerPalette[index] ?? "#ff8a5b";
      return chalk.hex(color).bold(line);
    })
    .join("\n");
}

/**
 * Return a dimmed version string.
 *
 * Prepends `"Version "` and applies `chalk.dim` for subtle display in help
 * output.
 */
export function formatVersionLine(version: string): string {
  return chalk.dim(`Version ${version}`);
}

/**
 * Prefix doctor output with the DevProxy version.
 *
 * Inserts an `info DevProxy version:` line at the top so the version appears
 * in both plain-text and JSON doctor flows.
 */
export function withDoctorVersion(output: string, version: string): string {
  return [`info DevProxy version: ${version}`, output].join("\n");
}

/**
 * Format a success message with a green `ok` prefix.
 *
 * Used by CLI action handlers to wrap positive results before printing.
 */
export function success(message: string): string {
  return `${chalk.green("ok")} ${message}`;
}

/**
 * Format a warning message with a yellow `warn` prefix.
 *
 * Used for non-fatal conditions such as Caddy not running.
 */
export function warning(message: string): string {
  return `${chalk.yellow("warn")} ${message}`;
}

/**
 * Format an error message with a red `error` prefix.
 *
 * Written to `stderr` by the top-level error handler in {@link runCli}.
 */
export function errorMessage(message: string): string {
  return `${chalk.red("error")} ${message}`;
}

/**
 * Format a list of registered services with colors.
 *
 * Boldens the heading, dims the empty-state message, and colorizes each row
 * by splitting on `" -> "` and applying cyan/green tints.
 */
export function formatList(output: string): string {
  if (output === "No services registered.") {
    return chalk.dim(output);
  }

  const [heading, ...rows] = output.split("\n");
  return [chalk.bold(heading), ...rows.map((row) => colorListRow(row))].join("\n");
}

/**
 * Format doctor output with colored prefixes.
 *
 * Recognizes `ok`, `warn`, `fail`, `hint`, and `info` prefixes and maps them
 * to the appropriate chalk colors.
 */
export function formatDoctor(output: string): string {
  return output
    .split("\n")
    .map((line) => {
      if (line.startsWith("ok ")) {
        return `${chalk.green("ok")} ${line.slice(3)}`;
      }

      if (line.startsWith("warn ")) {
        return `${chalk.yellow("warn")} ${line.slice(5)}`;
      }

      if (line.startsWith("fail ")) {
        return `${chalk.red("fail")} ${line.slice(5)}`;
      }

      if (line.startsWith("hint ")) {
        return `${chalk.cyan("hint")} ${line.slice(5)}`;
      }

      if (line.startsWith("info ")) {
        return `${chalk.blue("info")} ${line.slice(5)}`;
      }

      return chalk.dim(line);
    })
    .join("\n");
}

/**
 * Format status output with colored prefixes.
 *
 * Recognizes `ok`, `warn`, `fail`, `hint`, and `info` prefixes and maps them
 * to the appropriate chalk colors.
 */
export function formatStatus(output: string): string {
  return output
    .split("\n")
    .map((line) => {
      if (line.startsWith("ok ")) {
        return `${chalk.green("ok")} ${line.slice(3)}`;
      }

      if (line.startsWith("warn ")) {
        return `${chalk.yellow("warn")} ${line.slice(5)}`;
      }

      if (line.startsWith("fail ")) {
        return `${chalk.red("fail")} ${line.slice(5)}`;
      }

      if (line.startsWith("hint ")) {
        return `${chalk.cyan("hint")} ${line.slice(5)}`;
      }

      if (line.startsWith("info ")) {
        return `${chalk.blue("info")} ${line.slice(5)}`;
      }

      return chalk.dim(line);
    })
    .join("\n");
}

/**
 * Format certificate output with colored prefixes.
 *
 * Recognizes `ok`, `warn`, `fail`, `hint`, and `info` prefixes and maps them
 * to the appropriate chalk colors.
 */
export function formatCerts(output: string): string {
  return output
    .split("\n")
    .map((line) => {
      if (line.startsWith("ok ")) {
        return `${chalk.green("ok")} ${line.slice(3)}`;
      }

      if (line.startsWith("warn ")) {
        return `${chalk.yellow("warn")} ${line.slice(5)}`;
      }

      if (line.startsWith("fail ")) {
        return `${chalk.red("fail")} ${line.slice(5)}`;
      }

      if (line.startsWith("hint ")) {
        return `${chalk.cyan("hint")} ${line.slice(5)}`;
      }

      if (line.startsWith("info ")) {
        return `${chalk.blue("info")} ${line.slice(5)}`;
      }

      return chalk.dim(line);
    })
    .join("\n");
}

/**
 * Colorize a single list row.
 *
 * Splits the row on `" -> "` and applies cyan to the service name and green
 * to the upstream target, leaving the arrow dim.
 */
function colorListRow(row: string): string {
  const [name, target] = row.split(" -> ");
  if (!name || !target) {
    return row;
  }

  return `${chalk.cyan(name.trimEnd())} ${chalk.dim("->")} ${chalk.green(target)}`;
}
