/**
 * Application-specific error that carries an exit code.
 *
 * Thrown by business-logic and integration layers so the CLI can decide
 * whether to print a user-friendly message and set a specific exit code.
 */
export class DevProxyError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
  ) {
    super(message);
    this.name = "DevProxyError";
  }
}

/**
 * Normalize an unknown thrown value into a proper {@link Error}.
 *
 * Passes through existing `Error` instances and wraps everything else in a
 * generic `Error` using `String(error)`.
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
