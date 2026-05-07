import { request as httpsRequest } from "node:https";
import { Socket } from "node:net";

/**
 * Probe whether a TCP host:port is reachable.
 */
export async function probeTcpPort(host: string, port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;

    const finish = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Probe whether a URL responds successfully.
 */
export async function probeUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(750) });
    return response.ok || response.status >= 200;
  } catch {
    return false;
  }
}

/**
 * Probe whether an HTTPS URL is reachable, ignoring certificate errors.
 */
export async function probeHttpsUrl(url: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const request = httpsRequest(
      url,
      {
        method: "HEAD",
        rejectUnauthorized: false,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode !== undefined && response.statusCode < 500);
      },
    );

    let settled = false;

    const finish = (reachable: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      request.destroy();
      resolve(reachable);
    };

    request.setTimeout(750, () => finish(false));
    request.once("error", () => finish(false));
    request.end();
  });
}
