import { Box, Text, renderToString } from "ink";
import type { ReactNode } from "react";
import type { DoctorData, StatusData, StatusServiceData } from "../commands/services.js";
import type { Service } from "../core/types.js";

type Tone = "ok" | "warn" | "fail" | "hint" | "info" | "error";

type ParsedLine = {
  tone?: Tone;
  message: string;
};

const bannerLines = [
  "██████╗ ███████╗██╗   ██╗██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗",
  "██╔══██╗██╔════╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝",
  "██║  ██║█████╗  ██║   ██║██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ ",
  "██║  ██║██╔══╝  ╚██╗ ██╔╝██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  ",
  "██████╔╝███████╗ ╚████╔╝ ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║   ",
  "╚═════╝ ╚══════╝  ╚═══╝  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ",
] as const;

const bannerPalette = ["#00c2ff", "#3f8cff", "#7c5cff", "#c44dff", "#ff5ca8", "#ff8a5b"] as const;

const toneColor: Record<Tone, string> = {
  ok: "green",
  warn: "yellow",
  fail: "red",
  hint: "cyan",
  info: "blue",
  error: "red",
};

/**
 * Render the branded CLI banner using Ink components.
 */
export function renderBanner(): string {
  return renderCli(
    <Box flexDirection="column" marginBottom={1}>
      {bannerLines.map((line, index) => {
        const color = bannerPalette[index] ?? "#ff8a5b";

        return (
          <Text key={line} color={color} bold>
            {line}
          </Text>
        );
      })}

      <Text color="cyan">Stable HTTPS local domains for local development.</Text>
    </Box>,
  );
}

/**
 * Render a dimmed CLI version line.
 */
export function renderVersionLine(version: string): string {
  return renderCli(<Text dimColor>Version {version}</Text>);
}

/**
 * Render a success notice.
 */
export function renderSuccess(message: string): string {
  return renderCli(<Notice tone="ok" message={message} />);
}

/**
 * Render a warning notice.
 */
export function renderWarning(message: string): string {
  return renderCli(<Notice tone="warn" message={message} />);
}

/**
 * Render an error notice.
 */
export function renderErrorMessage(message: string): string {
  return renderCli(<Notice tone="error" message={message} />);
}

/**
 * Render the services list using Ink cards.
 */
export function renderList(data: { services: Service[] }): string {
  if (data.services.length === 0) {
    return renderCli(<Text dimColor>No services registered.</Text>);
  }

  return renderCli(
    <Box flexDirection="column">
      <Section title={`Registered services (${data.services.length})`} borderColor="cyan">
        {data.services.map((service, index) => {
          return <ServiceCard key={service.domain} service={service} padTop={index > 0} />;
        })}
      </Section>
    </Box>,
  );
}

/**
 * Render doctor output using structured diagnostic data.
 */
export function renderDoctor(data: DoctorData, version: string): string {
  const supportedPlatform =
    data.platform === "win32" || data.platform === "darwin" || data.platform === "linux";

  return renderCli(
    <Box flexDirection="column">
      <Section title="DevProxy doctor" borderColor="blue">
        <InfoRow label="DevProxy version" value={version} />
        <StatusRow
          tone={supportedPlatform ? "ok" : "warn"}
          message={`Supported platform: ${data.platform}`}
        />
        <StatusRow tone={data.caddyOnPath ? "ok" : "fail"} message="Caddy on PATH" />
        <StatusRow tone={data.hostsFileWritable ? "ok" : "warn"} message="Hosts file writable" />
        <InfoRow label="Registry" value={data.registryPath} />
        <InfoRow label="Caddyfile" value={data.caddyfilePath} />
      </Section>

      {data.hints.length > 0 ? (
        <Section title="Hints" borderColor="yellow" marginTop={1}>
          {data.hints.map((hint, index) => {
            return <StatusRow key={`${hint}-${index}`} tone="hint" message={hint} />;
          })}
        </Section>
      ) : null}
    </Box>,
  );
}

/**
 * Render status output using structured runtime status data.
 */
export function renderStatus(data: StatusData): string {
  return renderCli(
    <Box flexDirection="column">
      <Section
        title="Runtime status"
        borderColor={data.caddyInstalled ? (data.caddyRunning ? "green" : "yellow") : "red"}
      >
        <StatusRow tone={data.caddyInstalled ? "ok" : "fail"} message="Caddy on PATH" />
        {data.caddyInstalled ? (
          <StatusRow
            tone={data.caddyRunning ? "ok" : "warn"}
            message={`Caddy admin endpoint on localhost:2019 ${
              data.caddyRunning ? "is reachable" : "is not reachable"
            }`}
          />
        ) : null}
        <InfoRow label="Registered services" value={String(data.serviceCount)} />
      </Section>

      {data.services.length > 0 ? (
        <Section title="Services" borderColor="cyan" marginTop={1}>
          {data.services.map((service, index) => {
            return <ServiceStatusCard key={service.domain} service={service} padTop={index > 0} />;
          })}
        </Section>
      ) : (
        <Section title="Services" borderColor="cyan" marginTop={1}>
          <StatusRow tone="info" message="No services registered." />
        </Section>
      )}

      {data.hints.length > 0 ? (
        <Section title="Hints" borderColor="yellow" marginTop={1}>
          {data.hints.map((hint, index) => {
            return <StatusRow key={`${hint}-${index}`} tone="hint" message={hint} />;
          })}
        </Section>
      ) : null}
    </Box>,
  );
}

/**
 * Render certificate information using Ink sections and badges.
 */
export function renderCerts(output: string): string {
  const lines = output.split("\n").map(parsePrefixedLine);

  return renderCli(
    <Box flexDirection="column">
      <Section title="Caddy certificates" borderColor="magenta">
        {lines.map((line, index) => {
          return <ParsedOutputLine key={`${line.message}-${index}`} line={line} />;
        })}
      </Section>
    </Box>,
  );
}

function renderCli(node: ReactNode): string {
  return renderToString(node, { columns: getCliWidth() });
}

function getCliWidth(): number {
  const columns = process.stdout.columns ?? 100;

  return Math.max(80, Math.min(columns, 120));
}

function Notice({ tone, message }: { tone: Tone; message: string }): ReactNode {
  return (
    <Box borderStyle="round" borderColor={toneColor[tone]} paddingX={1} flexDirection="column">
      <StatusRow tone={tone} message={message} />
    </Box>
  );
}

function Section({
  title,
  borderColor,
  children,
  marginTop = 0,
}: {
  title: string;
  borderColor: string;
  children: ReactNode;
  marginTop?: number;
}): ReactNode {
  return (
    <Box
      marginTop={marginTop}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Text color={borderColor} bold>
        {title}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

function ToneBadge({ tone }: { tone: Tone }): ReactNode {
  return (
    <Text color={toneColor[tone]} bold>
      {tone}
    </Text>
  );
}

function StatusRow({ tone, message }: { tone: Tone; message: string }): ReactNode {
  return (
    <Box gap={1}>
      <Box width={6}>
        <ToneBadge tone={tone} />
      </Box>
      <Text wrap="wrap">{message}</Text>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="blue" bold>
        {label}:
      </Text>
      <Text wrap="wrap">{value}</Text>
    </Box>
  );
}

function ServiceCard({ service, padTop }: { service: Service; padTop: boolean }): ReactNode {
  return (
    <Box
      marginTop={padTop ? 1 : 0}
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
    >
      <Text color="cyan" bold>
        {service.name}
      </Text>
      <Text color="green">https://{service.domain}</Text>
      <Text dimColor>
        Upstream → 127.0.0.1:{service.port}, localhost:{service.port}
      </Text>
    </Box>
  );
}

function ServiceStatusCard({
  service,
  padTop,
}: {
  service: StatusServiceData;
  padTop: boolean;
}): ReactNode {
  const domainTone: Tone = service.domainReachable ? "ok" : "warn";
  const upstreamReachable = service.localhostReachable || service.loopbackReachable;
  const upstreamTone: Tone = upstreamReachable ? "ok" : "warn";

  return (
    <Box
      marginTop={padTop ? 1 : 0}
      borderStyle="single"
      borderColor={domainTone === "ok" ? "green" : "yellow"}
      paddingX={1}
      flexDirection="column"
    >
      <Text color="cyan" bold>
        https://{service.domain}/
      </Text>
      <Text dimColor>Port {service.port}</Text>
      <Box marginTop={1} flexDirection="column">
        <StatusRow
          tone={domainTone}
          message={`https://${service.domain}/ ${
            service.domainReachable
              ? "is reachable through Caddy"
              : "is not reachable through Caddy"
          }`}
        />
        <StatusRow
          tone={upstreamTone}
          message={`upstream ${service.domain} -> 127.0.0.1:${service.port} ${
            service.loopbackReachable ? "reachable" : "unreachable"
          }, localhost:${service.port} ${service.localhostReachable ? "reachable" : "unreachable"}`}
        />
      </Box>
    </Box>
  );
}

function ParsedOutputLine({ line }: { line: ParsedLine }): ReactNode {
  if (!line.tone) {
    return <Text dimColor>{line.message}</Text>;
  }

  if (line.tone === "info") {
    const detail = splitLabelAndValue(line.message);

    if (detail) {
      return <InfoRow label={detail.label} value={detail.value} />;
    }
  }

  return <StatusRow tone={line.tone} message={line.message} />;
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
