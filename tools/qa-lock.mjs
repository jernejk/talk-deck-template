// Task-owned locks only. No process termination, browser discovery or global policy.
import { mkdir, readFile, readdir, unlink, writeFile, link } from "node:fs/promises";
import { join, resolve } from "node:path";
import { availableParallelism, tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

export const RESOURCE_DIR = join(tmpdir(), `talk-deck-browser-${process.getuid?.() ?? "user"}`);
// Browser slots shared by every task-owned QA, lint and perf process on this machine.
// A slot is one Chromium page, which spends most of its time waiting on layout, paint and timers,
// so the default is the core count minus two (for Node and the browser's own processes), at least 4
// and at most 16. TALK_DECK_BROWSER_SLOTS sets it; every process on the machine should see the same value.
export const MAX_BROWSER_SLOTS = 64;
export function browserBudget(env = process.env, cores = availableParallelism()) {
  const set = env.TALK_DECK_BROWSER_SLOTS;
  if (set === undefined || set === "") return Math.min(16, Math.max(4, cores - 2));
  const n = Number(set);
  if (!Number.isInteger(n) || n < 1 || n > MAX_BROWSER_SLOTS) throw new Error(`TALK_DECK_BROWSER_SLOTS must be a whole number from 1 to ${MAX_BROWSER_SLOTS}, not "${set}".`);
  return n;
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code !== "ESRCH"; } };
const read = path => readFile(path, "utf8").then(JSON.parse);

async function ownedFile(path, data) {
  const temporary = `${path}.${randomUUID()}.pending`;
  await writeFile(temporary, JSON.stringify(data) + "\n", { flag: "wx" });
  try { await link(temporary, path); }
  finally { await unlink(temporary); }
  return async () => { if ((await read(path).catch(() => null))?.token === data.token) await unlink(path); };
}

export async function acquireOutputLock(out) {
  await mkdir(out, { recursive: true });
  const path = join(resolve(out), ".qa-active.json");
  const data = { token: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() };
  try { return await ownedFile(path, data); }
  catch (e) {
    if (e.code !== "EEXIST") throw e;
    const previous = await read(path).catch(() => null);
    if (previous?.pid && !alive(previous.pid)) {
      // Read back before removing our stale marker, never another tool's file.
      if ((await read(path).catch(() => null))?.token === previous.token) await unlink(path);
      return ownedFile(path, data);
    }
    throw new Error(`QA output is in use: ${path}. Wait for that run or choose a different --out.`);
  }
}

// All functional workers reserve slots; an exclusive perf/smoothness worker
// reserves the whole registry. Call release in finally, including launch failures.
export async function acquireResourceLock({ kind = "qa", slots = 1, budget = browserBudget(), directory = process.env.TALK_DECK_RESOURCE_DIR || RESOURCE_DIR, waitMs = Number(process.env.TALK_DECK_RESOURCE_WAIT_MS ?? 180000) } = {}) {
  if (!Number.isInteger(budget) || budget < 1 || budget > MAX_BROWSER_SLOTS) throw new Error(`The browser budget must be a whole number from 1 to ${MAX_BROWSER_SLOTS}.`);
  if (!["qa", "perf"].includes(kind) || !Number.isInteger(slots) || slots < 1 || slots > budget || !Number.isFinite(waitMs) || waitMs < 0) throw new Error(`Browser resources need kind qa/perf, 1–${budget} slots and a non-negative wait timeout.`);
  await mkdir(directory, { recursive: true });
  const deadline = Date.now() + waitMs, guard = join(directory, "guard");
  let reason = "registry guard is busy", announced = false;
  for (;;) {
    let releaseGuard;
    const owner = { token: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() };
    try { releaseGuard = await ownedFile(guard, owner); }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      const previous = await read(guard).catch(() => null);
      if (previous?.pid && !alive(previous.pid) && (await read(guard).catch(() => null))?.token === previous.token) {
        await unlink(guard).catch(e => { if (e.code !== "ENOENT") throw e; });
        continue;
      }
    }
    if (releaseGuard) {
      try {
        const holders = [];
        for (const name of (await readdir(directory)).filter(n => n.endsWith(".lease.json")).sort()) {
          const path = join(directory, name), lease = await read(path).catch(e => { if (e.code !== "ENOENT") throw e; return null; });
          if (!lease) continue;
          if (!Number.isInteger(lease.pid) || lease.pid < 1 || !Number.isInteger(lease.slots) || lease.slots < 1 || lease.slots > MAX_BROWSER_SLOTS || !["qa", "perf"].includes(lease.kind)) throw new Error(`Invalid task-owned browser lease: ${path}`);
          if (!alive(lease.pid)) await unlink(path);
          else holders.push(lease);
        }
        const used = holders.reduce((n, h) => n + h.slots, 0), need = kind === "perf" ? budget : slots;
        if (!holders.some(h => h.kind === "perf") && used + need <= budget) {
          const token = randomUUID();
          return await ownedFile(join(directory, `${token}.lease.json`), { token, pid: process.pid, kind, slots: need, startedAt: new Date().toISOString() });
        }
        reason = `budget busy (${used}/${budget} slots; requested ${kind} ${need})`;
      } finally { await releaseGuard(); }
    }
    if (Date.now() >= deadline) throw new Error(`Browser resource ${reason}; timed out after ${waitMs} ms. No unrelated processes were stopped.`);
    if (!announced) { console.error(`Waiting for task-owned browser resources: ${reason} (up to ${waitMs} ms).`); announced = true; }
    await new Promise(r => setTimeout(r, Math.min(100, Math.max(1, deadline - Date.now()))));
  }
}

export const acquireBrowserResources = acquireResourceLock;
