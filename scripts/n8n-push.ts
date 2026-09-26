/**
 * Push workflow JSON files from n8n/workflows into the n8n instance and activate them.
 * Credentials are created from n8n/credentials.json when missing (values come from the environment).
 * Usage: bun scripts/n8n-push.ts [file ...]   (defaults to every file in n8n/workflows)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { N8nClient, substituteEnv, type N8nCredentialRef, type N8nWorkflow } from "./n8n-lib";

const root = path.resolve(import.meta.dir, "..");
const client = new N8nClient();

async function ensureCredentials(): Promise<Map<string, N8nCredentialRef>> {
  const manifest = JSON.parse(
    substituteEnv(await readFile(path.join(root, "n8n/credentials.json"), "utf8")),
  ) as Array<{
    name: string;
    type: string;
    data: Record<string, string>;
  }>;
  const existing = new Map((await client.listCredentials()).data.map((c) => [c.name, c]));
  const out = new Map<string, N8nCredentialRef>();
  for (const cred of manifest) {
    const found = existing.get(cred.name);
    if (found) {
      out.set(cred.name, { id: found.id, name: found.name });
      continue;
    }
    const created = await client.request<N8nCredentialRef>("POST", "/credentials", cred);
    console.log(`created credential "${cred.name}"`);
    out.set(cred.name, { id: created.id, name: cred.name });
  }
  return out;
}

function resolvePlaceholders(text: string, creds: Map<string, N8nCredentialRef>): string {
  const withCreds = text.replace(/"\{\{CRED:([^}]+)\}\}"/g, (_, name: string) => {
    const ref = creds.get(name);
    if (!ref) throw new Error(`credential "${name}" is not in n8n/credentials.json`);
    return JSON.stringify(ref);
  });
  return substituteEnv(withCreds);
}

async function pushFile(
  file: string,
  creds: Map<string, N8nCredentialRef>,
  existing: N8nWorkflow[],
): Promise<void> {
  const wf = JSON.parse(resolvePlaceholders(await readFile(file, "utf8"), creds)) as N8nWorkflow;
  const body = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings ?? {},
  };
  const current = existing.find((w) => w.name === wf.name);
  let id: string;
  if (current?.id) {
    await client.request("PUT", `/workflows/${current.id}`, body);
    id = current.id;
    console.log(`updated "${wf.name}" (${id})`);
  } else {
    const created = await client.request<{ id: string }>("POST", "/workflows", body);
    id = created.id;
    console.log(`created "${wf.name}" (${id})`);
  }
  await client.request("POST", `/workflows/${id}/activate`);
  console.log(`  active at ${client.url}/workflow/${id}`);
}

const args = process.argv.slice(2);
const files =
  args.length > 0
    ? args.map((f) => path.resolve(f))
    : (await readdir(path.join(root, "n8n/workflows")))
        .filter((f) => f.endsWith(".json"))
        .toSorted()
        .map((f) => path.join(root, "n8n/workflows", f));

const creds = await ensureCredentials();
const existing = await client.listWorkflows();
for (const file of files) await pushFile(file, creds, existing);
