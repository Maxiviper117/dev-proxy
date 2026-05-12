export type ServiceMode = "attach";

export type Service = {
  name: string;
  domain: string;
  port: number;
  mode: ServiceMode;
  createdAt: string;
  updatedAt: string;
};

export type Registry = {
  version: 1;
  services: Service[];
};

export type RuntimePaths = {
  appDir: string;
  registryFile: string;
  caddyFile: string;
  hostsFile: string;
  caddyRootCAPath: string;
};

export type CommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<{ code: number; stdout: string; stderr: string }>;

export type ElevationRequest =
  | {
      kind: "hosts-sync";
      registryFile: string;
      hostsFile: string;
    }
  | {
      kind: "trust";
      rootCAPath: string;
    };

export type ElevationInvoker = (
  request: ElevationRequest,
) => Promise<{ code: number; stdout: string; stderr: string }>;

export type TcpProbe = (host: string, port: number) => Promise<boolean>;

export type UrlProbe = (url: string) => Promise<boolean>;

export type HttpsProbe = (url: string) => Promise<boolean>;

export type BrowserOpener = (url: string) => Promise<void>;

export type ConfirmFn = (config: { message: string; default?: boolean }) => Promise<boolean>;

export type CheckboxFn = (config: {
  message: string;
  searchable?: boolean;
  source: (answersSoFar: unknown, input?: string) => Promise<{ name: string; value: string }[]>;
  required?: boolean;
}) => Promise<string[]>;

export type ElevationChecker = () => Promise<boolean>;

export type DevProxyContext = {
  paths: RuntimePaths;
  run: CommandRunner;
  now: () => Date;
  platform: NodeJS.Platform;
  probeTcp?: TcpProbe;
  probeUrl?: UrlProbe;
  probeHttps?: HttpsProbe;
  openUrl?: BrowserOpener;
  confirm?: ConfirmFn;
  checkbox?: CheckboxFn;
  isElevated?: ElevationChecker;
  elevate?: ElevationInvoker;
};
