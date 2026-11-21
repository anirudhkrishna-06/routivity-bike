import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
export const db = connectionString ? drizzle(postgres(connectionString, { max: 5, prepare: false }), { schema }) : null;
