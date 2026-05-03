export type ServiceMode = "attach" | "managed";

export type Service = {
  name: string;
  domain: string;
  port: number;
  mode: ServiceMode;
  pid?: number;
  command?: string;
  cwd?: string;
  createdAt: string;
  updatedAt: string;
};

export type ManagedProcess = {
  pid: number;
  onExit: (callback: (code: number | null, signal: NodeJS.Signals | null) => void) => void;
  kill: () => Promise<void>;
};

export type ManagedProcessSpawner = (command: string, args: readonly string[]) => ManagedProcess;

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

export type TcpProbe = (host: string, port: number) => Promise<boolean>;

export type UrlProbe = (url: string) => Promise<boolean>;

export type HttpsProbe = (url: string) => Promise<boolean>;

export type BrowserOpener = (url: string) => Promise<void>;

export type DevProxyContext = {
  paths: RuntimePaths;
  run: CommandRunner;
  now: () => Date;
  platform: NodeJS.Platform;
  probeTcp?: TcpProbe;
  probeUrl?: UrlProbe;
  probeHttps?: HttpsProbe;
  openUrl?: BrowserOpener;
  spawnManaged?: ManagedProcessSpawner;
};
