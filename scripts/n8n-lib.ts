/** Shared helpers for the n8n push and export scripts. Reads N8N_BASE_URL and N8N_API_KEY from the environment (.env). */

export interface N8nCredentialRef {
  id: string;
  name: string;
}

export interface N8nWorkflow {
  id?: string;
  name: string;
  nodes: Array<Record<string, unknown> & { credentials?: Record<string, N8nCredentialRef> }>;
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  active?: boolean;
  tags?: unknown;
  pinData?: unknown;
  staticData?: unknown;
  versionId?: string;
  meta?: unknown;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Replace ${VAR} with the environment value; throws on a missing variable. */
export function substituteEnv(text: string): string {
  return text.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => requireEnv(name));
}

export class N8nClient {
  constructor(
    private readonly baseUrl = requireEnv("N8N_BASE_URL").replace(/\/$/, ""),
    private readonly apiKey = requireEnv("N8N_API_KEY"),
  ) {}

  get url(): string {
    return this.baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        "X-N8N-API-KEY": this.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const out: N8nWorkflow[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.request<{ data: N8nWorkflow[]; nextCursor?: string | null }>(
        "GET",
        `/workflows?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
      );
      out.push(...page.data);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return out;
  }

  listCredentials(): Promise<{ data: Array<N8nCredentialRef & { type: string }> }> {
    return this.request("GET", "/credentials");
  }
}
