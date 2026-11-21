import { localDb } from "./local-queue";

export async function flushPendingMutations(): Promise<{ mutationId: string; error?: string; [key: string]: unknown }[]> {
  if (!localDb || !navigator.onLine) return [];
  const results: { mutationId: string; error?: string; [key: string]: unknown }[] = [];
  const pending = await localDb.mutations.where("status").equals("pending").sortBy("createdAt");
  for (const mutation of pending) {
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: mutation.type, payload: mutation.payload }) });
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Sync request failed");
      results.push({ mutationId: mutation.id, ...body });
      await localDb.mutations.delete(mutation.id);
    } catch (error) {
      results.push({ mutationId: mutation.id, error: error instanceof Error ? error.message : "Sync failed" });
      await localDb.mutations.update(mutation.id, { attempts: mutation.attempts + 1, status: mutation.attempts >= 4 ? "failed" : "pending" });
      break;
    }
  }
  return results;
}
