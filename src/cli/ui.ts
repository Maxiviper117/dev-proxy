import chalk from "chalk";
import type {
  DoctorData,
  DoctorFixItem,
  DoctorFixResult,
  StatusData,
  StatusServiceData,
} from "../commands/services.js";
import type { Service } from "../core/types.js";

type Tone = "ok" | "warn" | "fail" | "hint" | "info" | "error";

type ParsedLine = {
  tone?: Tone;
  message: string;
};

const toneColor: Record<Tone, (message: string) => string> = {
  ok: chalk.green,
  warn: chalk.yellow,
  fail: chalk.red,
  hint: chalk.cyan,
  info: chalk.blue,
  error: chalk.red,
};

/**
 * Render a success notice.
 */
export function renderSuccess(message: string): string {
  return renderNotice("ok", message);
}

/**
 * Render a warning notice.
 */
export function renderWarning(message: string): string {
  return renderNotice("warn", message);
}

/**
 * Render an error notice.
 */
export function renderErrorMessage(message: string): string {
  return renderNotice("error", message);
}

/**
 * Render the services list.
 */
export function renderList(data: { services: Service[] }): string {
  if (data.services.length === 0) {
    return chalk.dim("No services registered.");
  }

  return renderSection(
    `Registered services (${data.services.length})`,
    "cyan",
    data.services.map(renderServiceCard).join("\n\n"),
  );
}

/**
 * Render doctor output using structured diagnostic data.
 */
export function renderDoctor(
  data: DoctorData & { fixResult?: DoctorFixResult },
  version: string,
): string {
  const supportedPlatform =
    data.platform === "win32" || data.platform === "darwin" || data.platform === "linux";
  const sections = [
    renderSection(
      "DevProxy doctor",
      "blue",
      [
        renderInfoRow("DevProxy version", version),
        renderStatusRow(
          supportedPlatform ? "ok" : "warn",
          supportedPlatform
            ? `Supported platform: ${data.platform}`
            : `Unsupported platform: ${data.platform}`,
        ),
        renderStatusRow(
          data.caddyOnPath ? "ok" : "fail",
          data.caddyOnPath ? "Caddy on PATH" : "Caddy not on PATH",
        ),
        renderStatusRow(
          data.hostsFileWritable ? "ok" : "warn",
          data.hostsFileWritable ? "Hosts file writable" : "Hosts file not writable",
        ),
        renderStatusRow(
          data.hostsDrift.inSync ? "ok" : "warn",
          data.hostsDrift.inSync ? "Hosts entries match registry" : "Hosts drift detected",
        ),
        renderInfoRow("Registry", data.registryPath),
        renderInfoRow("Caddyfile", data.caddyfilePath),
        data.caddyValidation.skipped
          ? renderStatusRow("info", "Caddy config validation skipped")
          : renderStatusRow(
              data.caddyValidation.valid ? "ok" : "fail",
              data.caddyValidation.valid
                ? "Caddy config valid"
                : `Caddy config invalid: ${data.caddyValidation.error ?? "unknown error"}`,
            ),
        ...data.duplicatePorts.map((dup) =>
          renderStatusRow("warn", `Port conflict on :${dup.port}: ${dup.services.join(", ")}`),
        ),
      ].join("\n"),
    ),
  ];

  if (data.hints.length > 0) {
    sections.push(
      renderSection(
        "Hints",
        "yellow",
        data.hints.map((hint) => renderStatusRow("hint", hint)).join("\n"),
      ),
    );
  }

  if (data.fixResult && data.fixResult.items.length > 0) {
    sections.push(
      renderSection(
        "Fixes",
        "magenta",
        [
          ...data.fixResult.items.map(renderFixItem),
          chalk.bold(
            `Fixed: ${data.fixResult.fixed}, Skipped: ${data.fixResult.skipped}, Manual: ${data.fixResult.manual}`,
          ),
        ].join("\n"),
      ),
    );
  }

  return sections.join("\n\n");
}

/**
 * Render status output using structured runtime status data.
 */
export function renderStatus(data: StatusData): string {
  const sections = [
    renderSection(
      "Runtime status",
      data.caddyInstalled ? (data.caddyRunning ? "green" : "yellow") : "red",
      [
        renderStatusRow(data.caddyInstalled ? "ok" : "fail", "Caddy on PATH"),
        data.caddyInstalled
          ? renderStatusRow(
              data.caddyRunning ? "ok" : "warn",
              `Caddy is ${data.caddyRunning ? "running" : "not running"}`,
            )
          : undefined,
        data.caddyInstalled
          ? renderStatusRow(
              data.caddyRunning ? "ok" : "warn",
              `Caddy admin endpoint on localhost:2019 ${
                data.caddyRunning ? "is reachable" : "is not reachable"
              }`,
            )
          : undefined,
        renderInfoRow("Registered services", String(data.serviceCount)),
      ]
        .filter((line): line is string => line !== undefined)
        .join("\n"),
    ),
  ];

  sections.push(
    renderSection(
      "Services",
      "cyan",
      data.services.length > 0
        ? data.services.map(renderServiceStatusCard).join("\n\n")
        : renderStatusRow("info", "No services registered."),
    ),
  );

  if (data.hints.length > 0) {
    sections.push(
      renderSection(
        "Hints",
        "yellow",
        data.hints.map((hint) => renderStatusRow("hint", hint)).join("\n"),
      ),
    );
  }

  return sections.join("\n\n");
}

/**
 * Render certificate information using sections and badges.
 */
export function renderCerts(output: string): string {
  const lines = output.split("\n").map(parsePrefixedLine).map(renderParsedOutputLine);

  return renderSection("Caddy certificates", "magenta", lines.join("\n"));
}

function renderNotice(tone: Tone, message: string): string {
  return message
    .split("\n")
    .map((line, index) => {
      const parsed = parsePrefixedLine(line);
      if (parsed.tone) {
        return renderParsedOutputLine(parsed);
      }

      return renderStatusRow(index === 0 ? tone : "info", line);
    })
    .join("\n");
}

function renderSection(title: string, color: string, body: string): string {
  const colorize = chalkColor(color);
  return [colorize.bold(title), body].join("\n");
}

function renderServiceCard(service: Service): string {
  return [
    chalk.cyan.bold(service.name),
    chalk.green(`https://${service.domain}`),
    chalk.dim(`Upstream -> 127.0.0.1:${service.port}, localhost:${service.port}`),
  ].join("\n");
}

function renderServiceStatusCard(service: StatusServiceData): string {
  const domainTone: Tone = service.domainReachable ? "ok" : "warn";
  const upstreamReachable = service.localhostReachable || service.loopbackReachable;
  const upstreamTone: Tone = upstreamReachable ? "ok" : "warn";

  return [
    chalk.cyan.bold(`https://${service.domain}/`),
    chalk.dim(`Port ${service.port}`),
    renderStatusRow(
      domainTone,
      `https://${service.domain}/ ${
        service.domainReachable ? "is reachable through Caddy" : "is not reachable through Caddy"
      }`,
    ),
    renderStatusRow(
      upstreamTone,
      `upstream ${service.domain} -> 127.0.0.1:${service.port} ${
        service.loopbackReachable ? "reachable" : "unreachable"
      }, localhost:${service.port} ${service.localhostReachable ? "reachable" : "unreachable"}`,
    ),
  ].join("\n");
}

function renderStatusRow(tone: Tone, message: string): string {
  return `${toneColor[tone](tone.padEnd(6))} ${message}`;
}

function renderInfoRow(label: string, value: string): string {
  return `${chalk.blue.bold(`${label}:`)}\n${value}`;
}

function renderParsedOutputLine(line: ParsedLine): string {
  if (!line.tone) {
    return chalk.dim(line.message);
  }

  if (line.tone === "info") {
    const detail = splitLabelAndValue(line.message);

    if (detail) {
      return renderInfoRow(detail.label, detail.value);
    }
  }

  return renderStatusRow(line.tone, line.message);
}

function parsePrefixedLine(line: string): ParsedLine {
  const tones: Tone[] = ["ok", "warn", "fail", "hint", "info", "error"];

  for (const tone of tones) {
    const prefix = `${tone} `;

    if (line.startsWith(prefix)) {
      return {
        tone,
        message: line.slice(prefix.length),
      };
    }
  }

  return { message: line };
}

function splitLabelAndValue(message: string): { label: string; value: string } | undefined {
  const separatorIndex = message.indexOf(":");

  if (separatorIndex === -1) {
    return undefined;
  }

  return {
    label: message.slice(0, separatorIndex),
    value: message.slice(separatorIndex + 1).trimStart(),
  };
}

function renderFixItem(item: DoctorFixItem): string {
  const statusLabel =
    item.status === "fixed"
      ? chalk.green("✓ fixed")
      : item.status === "skipped"
        ? chalk.yellow("○ skipped")
        : chalk.red("✗ manual");
  return `${statusLabel} ${chalk.bold(item.action)}\n${chalk.dim(`  ${item.detail}`)}`;
}

function chalkColor(color: string): typeof chalk {
  switch (color) {
    case "blue":
      return chalk.blue;
    case "cyan":
      return chalk.cyan;
    case "green":
      return chalk.green;
    case "magenta":
      return chalk.magenta;
    case "red":
      return chalk.red;
    case "yellow":
      return chalk.yellow;
    default:
      return chalk;
  }
}
