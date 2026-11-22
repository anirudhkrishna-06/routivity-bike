import Dexie, { type Table } from "dexie";
export type PendingMutation = { id: string; tripId: string; type: string; payload: unknown; createdAt: number; attempts: number; status: "pending" | "failed" | "blocked" };
class RoutivityDB extends Dexie { mutations!: Table<PendingMutation, string>; constructor() { super("routivity-local"); this.version(1).stores({ mutations: "id, tripId, status, createdAt" }); } }
export const localDb = typeof window === "undefined" ? null : new RoutivityDB();
export async function queueMutation(mutation: Omit<PendingMutation, "attempts" | "status">) { if (!localDb) return; await localDb.mutations.put({ ...mutation, attempts: 0, status: "pending" }); }
export async function pendingMutationCount() { return localDb ? localDb.mutations.where("status").equals("pending").count() : 0; }
export async function listQueuedMutations() { return localDb ? localDb.mutations.orderBy("createdAt").reverse().toArray() : []; }
export async function retryFailedMutations() { if (!localDb) return; await localDb.mutations.where("status").equals("failed").modify({ status: "pending" }); }
export async function discardMutation(id: string) { if (localDb) await localDb.mutations.delete(id); }
export async function exportQueuedMutations() { const items = await listQueuedMutations(); return JSON.stringify({ exportedAt: new Date().toISOString(), warning: "Unsynced changes — keep this file safe for support recovery.", mutations: items }, null, 2); }
