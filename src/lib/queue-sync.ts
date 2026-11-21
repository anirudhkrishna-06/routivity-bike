import { localDb } from "./local-queue";

export async function flushPendingMutations() {
  if (!localDb || !navigator.onLine) return;
  const pending = await localDb.mutations.where("status").equals("pending").sortBy("createdAt");
  for (const mutation of pending) {
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: mutation.type, payload: mutation.payload }) });
      if (!response.ok) throw new Error("Sync request failed");
      await localDb.mutations.delete(mutation.id);
    } catch {
      await localDb.mutations.update(mutation.id, { attempts: mutation.attempts + 1, status: mutation.attempts >= 4 ? "failed" : "pending" });
      break;
    }
  }
}
