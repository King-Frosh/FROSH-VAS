import { db, dbConfigured } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbConfigured()) {
    return Response.json(
      {
        ok: false,
        db: "not-configured",
        detail: "DATABASE_URL is missing from the server environment.",
      },
      { status: 500 },
    );
  }
  try {
    await ensureDatabaseReady();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "ok" });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        db: "error",
        detail: err instanceof Error ? err.message : "unknown database error",
      },
      { status: 500 },
    );
  }
}
