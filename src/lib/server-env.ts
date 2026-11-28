/**
 * Server secrets (API keys) for server-only code. On the deployed site the server runs as a Cloudflare
 * Worker: secrets arrive as the Worker's `env` bindings on each request, not in process.env (Lovable's
 * build turns off the nodejs_compat flag that would copy them there). src/server.ts hands those bindings
 * to rememberServerEnv() on every request, and nitro's runtime also keeps them on globalThis.__env__;
 * serverEnv() reads those first, then process.env (local dev, tests and other hosts).
 */
let bindings: Record<string, unknown> = {};

export function rememberServerEnv(env: unknown) {
  if (env && typeof env === "object") bindings = env as Record<string, unknown>;
}

/** nitro's Cloudflare runtime puts the Worker env on globalThis.__env__ for each request. */
const nitroEnv = () =>
  ((globalThis as Record<string, unknown>)["__env__"] ?? {}) as Record<string, unknown>;

export function serverEnv(name: string): string | undefined {
  for (const src of [bindings, nitroEnv()]) {
    const v = src[name];
    if (typeof v === "string" && v) return v;
  }
  const proc =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {};
  const fromProcess = proc[name];
  if (fromProcess) return fromProcess;
  const g = (globalThis as Record<string, unknown>)[name];
  return typeof g === "string" && g ? g : undefined;
}

/**
 * For troubleshooting a missing secret: the NAMES (never values) of the text settings the server can see,
 * by place. Names that look like the app's own internals are left out.
 */
export function serverEnvNames(): Record<string, string[]> {
  const names = (o: Record<string, unknown>) =>
    Object.keys(o)
      .filter((k) => typeof o[k] === "string" && /^[A-Z][A-Z0-9_]+$/.test(k))
      .filter((k) => !/^(npm_|NODE_|PATH$|HOME$|PWD$|SHELL$|TERM|LANG|HOSTNAME$|USER$)/.test(k))
      .sort();
  const proc = typeof process !== "undefined" ? (process.env as Record<string, unknown>) : {};
  return { worker: names(bindings), nitro: names(nitroEnv()), process: names(proc) };
}
