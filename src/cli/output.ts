import chalk from "chalk";

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

function colorListRow(row: string): string {
  const [name, target] = row.split(" -> ");
  if (!name || !target) {
    return row;
  }

  return `${chalk.cyan(name.trimEnd())} ${chalk.dim("->")} ${chalk.green(target)}`;
}
