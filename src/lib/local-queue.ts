import Dexie, { type Table } from "dexie";
export type PendingMutation = { id: string; tripId: string; type: string; payload: unknown; createdAt: number; attempts: number; status: "pending" | "failed" };
class RoutivityDB extends Dexie { mutations!: Table<PendingMutation, string>; constructor() { super("routivity-local"); this.version(1).stores({ mutations: "id, tripId, status, createdAt" }); } }
export const localDb = typeof window === "undefined" ? null : new RoutivityDB();
export async function queueMutation(mutation: Omit<PendingMutation, "attempts" | "status">) { if (!localDb) return; await localDb.mutations.put({ ...mutation, attempts: 0, status: "pending" }); }
export async function pendingMutationCount() { return localDb ? localDb.mutations.where("status").equals("pending").count() : 0; }
