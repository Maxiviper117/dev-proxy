<script lang="ts">
  type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
  type Service = { name: string; domain: string; port: number };
  type StatusServiceData = {
    name: string;
    domain: string;
    port: number;
    domainReachable: boolean;
    localhostReachable: boolean;
    loopbackReachable: boolean;
  };
  type StatusData = {
    caddyInstalled: boolean;
    caddyRunning: boolean;
    serviceCount: number;
    services: StatusServiceData[];
    hints: string[];
  };
  type DoctorData = {
    hostsDrift: { inSync: boolean };
    duplicatePorts: { port: number; services: string[] }[];
    caddyfilePreview: string;
  };
  type BootstrapData = {
    version: string;
    platform: string;
    paths: { registryFile: string; caddyFile: string };
    services: Service[];
    status: StatusData;
    doctor: DoctorData;
  };

  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const elevatedCommands = [
    "devproxy sync-hosts",
    "devproxy trust",
    "devproxy add <name> --port <port>",
    "devproxy update <name> --port <port>",
  ];

  let data: BootstrapData | null = null;
  let loading = true;
  let busy = false;
  let error = "";
  let actionMessage = "";
  let copied = "";

  $: services = data?.status.services ?? [];
  $: reachableDomains = services.filter((service) => service.domainReachable).length;
  $: reachableUpstreams = services.filter(
    (service) => service.localhostReachable || service.loopbackReachable,
  ).length;
  $: issueCount =
    (data && !data.status.caddyInstalled ? 1 : 0) +
    (data && !data.status.caddyRunning ? 1 : 0) +
    (data && !data.doctor.hostsDrift.inSync ? 1 : 0) +
    (data?.doctor.duplicatePorts.length ?? 0);

  function healthTone(online: boolean) {
    return online
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  }

  function statusText(online: boolean) {
    return online ? "Online" : "Offline";
  }

  function upstreamText(service: StatusServiceData) {
    if (service.loopbackReachable && service.localhostReachable) {
      return "Both reachable";
    }
    if (service.loopbackReachable) {
      return "127.0.0.1 only";
    }
    if (service.localhostReachable) {
      return "localhost only";
    }
    return "Offline";
  }

  async function callApi<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
    const url = `/api${path}?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.ok) {
      throw new Error(payload.error);
    }
    return payload.data;
  }

  async function load() {
    loading = true;
    error = "";
    try {
      data = await callApi<BootstrapData>("/bootstrap");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  async function runAction(
    action: () => Promise<{ message: string; warnings?: string[] } | { message: string }>,
  ) {
    busy = true;
    actionMessage = "";
    error = "";
    try {
      const result = await action();
      const lines = [result.message];
      if ("warnings" in result && result.warnings && result.warnings.length > 0) {
        lines.push(...result.warnings);
      }
      actionMessage = lines.join("\n");
      await load();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function startCaddy() {
    await runAction(() =>
      callApi<{ message: string; warnings: string[] }>("/actions/start", "POST"),
    );
  }

  async function stopCaddy() {
    await runAction(() => callApi<{ message: string }>("/actions/stop", "POST"));
  }

  async function openService(name: string) {
    await runAction(() => callApi<{ message: string }>("/actions/open", "POST", { name }));
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    copied = value;
    window.setTimeout(() => {
      if (copied === value) {
        copied = "";
      }
    }, 1400);
  }

  void load();
</script>

<main class="min-h-screen bg-[#eef2ef] text-zinc-950">
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
    <header class="flex flex-col gap-4 border-b border-zinc-300 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-normal text-teal-700">DevProxy</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-normal text-zinc-950 md:text-4xl">
          Local Proxy Console
        </h1>
      </div>

      {#if data}
        <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[560px]">
          <div class="border border-zinc-300 bg-white p-3">
            <div class="text-xs font-medium uppercase tracking-normal text-zinc-500">Version</div>
            <div class="mt-1 font-semibold">{data.version}</div>
          </div>
          <div class="border border-zinc-300 bg-white p-3">
            <div class="text-xs font-medium uppercase tracking-normal text-zinc-500">Platform</div>
            <div class="mt-1 font-semibold">{data.platform}</div>
          </div>
          <div class="border border-zinc-300 bg-white p-3">
            <div class="text-xs font-medium uppercase tracking-normal text-zinc-500">Domains</div>
            <div class="mt-1 font-semibold">{reachableDomains}/{services.length}</div>
          </div>
          <div class="border border-zinc-300 bg-white p-3">
            <div class="text-xs font-medium uppercase tracking-normal text-zinc-500">Issues</div>
            <div class="mt-1 font-semibold">{issueCount}</div>
          </div>
        </div>
      {/if}
    </header>

    {#if loading}
      <section class="grid gap-3 md:grid-cols-3">
        <div class="h-28 animate-pulse border border-zinc-300 bg-white"></div>
        <div class="h-28 animate-pulse border border-zinc-300 bg-white"></div>
        <div class="h-28 animate-pulse border border-zinc-300 bg-white"></div>
      </section>
    {:else if error}
      <section class="border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
        <div class="font-semibold">Request failed</div>
        <div class="mt-1">{error}</div>
      </section>
    {:else if data}
      <section class="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <div class="border border-zinc-300 bg-white">
          <div class="flex flex-col gap-3 border-b border-zinc-200 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-lg font-semibold">Services</h2>
              <p class="text-sm text-zinc-500">{reachableUpstreams}/{services.length} upstreams reachable</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn-secondary" onclick={load} disabled={busy}>Refresh</button>
              <button class="btn-primary" onclick={startCaddy} disabled={busy}>Start</button>
              <button class="btn-secondary" onclick={stopCaddy} disabled={busy}>Stop</button>
            </div>
          </div>

          {#if actionMessage}
            <pre class="m-4 max-h-36 overflow-auto border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-100">{actionMessage}</pre>
          {/if}

          {#if services.length === 0}
            <div class="p-8">
              <div class="border border-dashed border-zinc-300 bg-zinc-50 p-6">
                <div class="text-lg font-semibold">No services registered</div>
                <button
                  class="btn-secondary mt-4"
                  onclick={() => copyText("devproxy add <name> --port <port>")}
                >
                  {copied === "devproxy add <name> --port <port>" ? "Copied" : "Copy add command"}
                </button>
              </div>
            </div>
          {:else}
            <div class="grid gap-3 p-4 md:hidden">
              {#each services as service}
                <article class="border border-zinc-200 bg-zinc-50 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <h3 class="truncate font-semibold">{service.name}</h3>
                      <div class="truncate text-sm text-zinc-600">{service.domain}</div>
                    </div>
                    <button class="btn-primary shrink-0" onclick={() => openService(service.name)} disabled={busy}>
                      Open
                    </button>
                  </div>
                  <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span class={`status-pill ${healthTone(service.domainReachable)}`}>
                      Domain {statusText(service.domainReachable)}
                    </span>
                    <span class={`status-pill ${healthTone(service.localhostReachable)}`}>
                      localhost
                    </span>
                    <span class={`status-pill ${healthTone(service.loopbackReachable)}`}>
                      127.0.0.1
                    </span>
                  </div>
                </article>
              {/each}
            </div>

            <div class="hidden overflow-x-auto md:block">
              <table class="w-full border-collapse text-sm">
                <thead class="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-normal text-zinc-500">
                  <tr>
                    <th class="border-b border-zinc-200 px-4 py-3">Name</th>
                    <th class="border-b border-zinc-200 px-4 py-3">Domain</th>
                    <th class="border-b border-zinc-200 px-4 py-3">Port</th>
                    <th class="border-b border-zinc-200 px-4 py-3">Domain</th>
                    <th class="border-b border-zinc-200 px-4 py-3">Upstream</th>
                    <th class="border-b border-zinc-200 px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {#each services as service}
                    <tr class="hover:bg-zinc-50">
                      <td class="border-b border-zinc-200 px-4 py-3 font-medium">{service.name}</td>
                      <td class="border-b border-zinc-200 px-4 py-3 text-zinc-600">{service.domain}</td>
                      <td class="border-b border-zinc-200 px-4 py-3">{service.port}</td>
                      <td class="border-b border-zinc-200 px-4 py-3">
                        <span class={`status-pill ${healthTone(service.domainReachable)}`}>
                          {statusText(service.domainReachable)}
                        </span>
                      </td>
                      <td class="border-b border-zinc-200 px-4 py-3">
                        <span class={`status-pill ${healthTone(service.localhostReachable || service.loopbackReachable)}`}>
                          {upstreamText(service)}
                        </span>
                      </td>
                      <td class="border-b border-zinc-200 px-4 py-3 text-right">
                        <button class="btn-primary" onclick={() => openService(service.name)} disabled={busy}>
                          Open
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <aside class="grid gap-3">
          <section class="border border-zinc-300 bg-white p-4">
            <h2 class="text-lg font-semibold">Runtime</h2>
            <div class="mt-3 grid gap-2 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span class="text-zinc-500">Caddy installed</span>
                <span class={`status-pill ${healthTone(data.status.caddyInstalled)}`}>
                  {data.status.caddyInstalled ? "Installed" : "Missing"}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-zinc-500">Caddy running</span>
                <span class={`status-pill ${healthTone(data.status.caddyRunning)}`}>
                  {data.status.caddyRunning ? "Running" : "Stopped"}
                </span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-zinc-500">Hosts block</span>
                <span class={`status-pill ${healthTone(data.doctor.hostsDrift.inSync)}`}>
                  {data.doctor.hostsDrift.inSync ? "Synced" : "Drifted"}
                </span>
              </div>
            </div>
          </section>

          <section class="border border-zinc-300 bg-white p-4">
            <h2 class="text-lg font-semibold">Diagnostics</h2>
            <div class="mt-3 space-y-2 text-sm">
              {#if data.doctor.duplicatePorts.length === 0 && data.status.hints.length === 0}
                <div class="border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  No duplicate ports or runtime hints.
                </div>
              {:else}
                {#each data.doctor.duplicatePorts as dup}
                  <div class="border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    Port {dup.port}: {dup.services.join(", ")}
                  </div>
                {/each}
                {#each data.status.hints as hint}
                  <div class="border border-amber-200 bg-amber-50 p-3 text-amber-900">{hint}</div>
                {/each}
              {/if}
            </div>
          </section>
        </aside>
      </section>

      <section class="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
        <div class="border border-zinc-300 bg-white p-4">
          <h2 class="text-lg font-semibold">Paths</h2>
          <div class="mt-3 space-y-3 text-sm">
            <div>
              <div class="mb-1 text-xs font-semibold uppercase tracking-normal text-zinc-500">Registry</div>
              <code class="block break-all border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800">
                {data.paths.registryFile}
              </code>
            </div>
            <div>
              <div class="mb-1 text-xs font-semibold uppercase tracking-normal text-zinc-500">Caddyfile</div>
              <code class="block break-all border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800">
                {data.paths.caddyFile}
              </code>
            </div>
          </div>
        </div>

        <div class="border border-zinc-300 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">Caddyfile</h2>
            <button class="btn-secondary" onclick={() => copyText(data.doctor.caddyfilePreview)}>
              {copied === data.doctor.caddyfilePreview ? "Copied" : "Copy"}
            </button>
          </div>
          <pre class="mt-3 max-h-80 overflow-auto border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">{data.doctor.caddyfilePreview}</pre>
        </div>
      </section>

      <section class="border border-zinc-300 bg-white p-4">
        <h2 class="text-lg font-semibold">Elevated Commands</h2>
        <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {#each elevatedCommands as command}
            <button
              class="flex min-h-12 items-center justify-between gap-3 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm hover:border-teal-700 disabled:opacity-70"
              onclick={() => copyText(command)}
            >
              <code class="break-all text-xs text-zinc-800">{command}</code>
              <span class="shrink-0 text-xs font-semibold text-teal-700">
                {copied === command ? "Copied" : "Copy"}
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
  </div>
</main>
