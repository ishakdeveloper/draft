/**
 * Export every workflow from the n8n instance into n8n/workflows as portable JSON:
 * instance ids, pin data and static data are stripped, credential ids become {{CRED:name}}
 * placeholders and the worker URL becomes ${WORKER_URL}.
 * Usage: bun scripts/n8n-export.ts
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { N8nClient, requireEnv, type N8nWorkflow } from "./n8n-lib";

const root = path.resolve(import.meta.dir, "..");
const client = new N8nClient();
const workerUrl = requireEnv("WORKER_URL");

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

for (const summary of await client.listWorkflows()) {
  const wf = await client.request<N8nWorkflow>("GET", `/workflows/${summary.id}`);
  const nodes = wf.nodes.map((node) => {
    const { credentials, ...rest } = node;
    const out: Record<string, unknown> = { ...rest };
    if (credentials) {
      out.credentials = Object.fromEntries(
        Object.entries(credentials).map(([type, ref]) => [type, `{{CRED:${ref.name}}}`]),
      );
    }
    return out;
  });
  const portable = {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: wf.settings ?? {},
  };
  const text = JSON.stringify(portable, null, 2)
    .replaceAll(workerUrl, "${WORKER_URL}")
    .replace(/"\{\{CRED:([^}]+)\}\}"/g, '"{{CRED:$1}}"');
  const match = /^(\d\d)-/.exec(slug(wf.name));
  const file = path.join(root, "n8n/workflows", `${match ? "" : ""}${slug(wf.name)}.json`);
  await writeFile(file, `${text}\n`);
  console.log(`exported "${wf.name}" -> ${path.relative(root, file)}`);
}
