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

export function formatBanner(): string {
  return bannerLines
    .map((line, index) => {
      const color = bannerPalette[index] ?? "#ff8a5b";
      return chalk.hex(color).bold(line);
    })
    .join("\n");
}

export function formatVersionLine(version: string): string {
  return chalk.dim(`Version ${version}`);
}

export function withDoctorVersion(output: string, version: string): string {
  return [`info DevProxy version: ${version}`, output].join("\n");
}

export function success(message: string): string {
  return `${chalk.green("ok")} ${message}`;
}

export function warning(message: string): string {
  return `${chalk.yellow("warn")} ${message}`;
}

export function errorMessage(message: string): string {
  return `${chalk.red("error")} ${message}`;
}

export function formatList(output: string): string {
  if (output === "No services registered.") {
    return chalk.dim(output);
  }

  const [heading, ...rows] = output.split("\n");
  return [chalk.bold(heading), ...rows.map((row) => colorListRow(row))].join("\n");
}

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

function colorListRow(row: string): string {
  const [name, target] = row.split(" -> ");
  if (!name || !target) {
    return row;
  }

  return `${chalk.cyan(name.trimEnd())} ${chalk.dim("->")} ${chalk.green(target)}`;
}
