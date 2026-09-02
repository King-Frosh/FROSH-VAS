import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/init";
import { services } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Service IDs uploaded by the VAS operations team.
 * Two families exist: 234012… and 234102… (first 6 digits = group code).
 */
export const SEEDED_SERVICE_IDS: string[] = [
  "234012000013654",
  "234012000025788",
  "234012000026109",
  "234012000026092",
  "234012000026093",
  "234012000025787",
  "234012000022547",
  "234012000022546",
  "234102200006491",
  "234102200006472",
  "234102200006488",
  "234102200006486",
  "234102200006490",
  "234102200006483",
  "234102200006508",
  "234102200006470",
  "234102200006478",
  "234102200006471",
  "234102200006489",
  "234102200006487",
  "234012000026411",
  "234102200006492",
  "23401200006485",
  "234012000026048",
  "234102200006410",
  "23401200006648",
  "234012000025947",
  "234012000008316",
  "234012000008331",
  "234012000008332",
  "234012000008333",
  "234012000008334",
  "234102200006736",
  "234102200006742",
  "234102200006872",
  "234102200006873",
  "234102200006871",
  "234102200006652",
  "234102200006702",
  "234102200006911",
  "234102200006909",
  "234102200006910",
  "234102200006919",
  "234102200006920",
  "234102200006968",
  "234102200006967",
  "234102200006969",
  "234102200006966",
  "234102200006977",
  "234102200006982",
  "234102200006983",
  "234102200006993",
  "234102200006494",
  "234102200007022",
  "234102200007023",
  "234102200007032",
  "234102200007046",
  "234102200007131",
  "234102200007021",
  "234102200007152",
  "234102200007169",
  "234102200007176",
  "234102200007310",
  "23410220008095",
  "23410220008198",
  "23410220008616",
  "23410220008618",
  "23410220008482",
  "234012000026410", 
  "234102200006485", 
  "234102200006852",
  "234102200008198", 
  "234102200008616",
];

export function groupOf(serviceId: string): string {
  return (serviceId || "").slice(0, 6);
}

const globalForRegistry = globalThis as typeof globalThis & {
  __vasRegistryEnsured?: Promise<void>;
};

/** Idempotently seeds the uploaded service registry on first use. */
export function ensureRegistry(): Promise<void> {
  if (!globalForRegistry.__vasRegistryEnsured) {
    globalForRegistry.__vasRegistryEnsured = (async () => {
      try {
        await ensureDatabaseReady();
        const [row] = await db
          .select({ count: sql<number>`count(*)::int`.mapWith(Number) })
          .from(services);
        if ((row?.count ?? 0) === 0) {
          await db.insert(services).values(
            SEEDED_SERVICE_IDS.map((sid) => ({
              serviceId: sid,
              groupCode: groupOf(sid),
              name: "",
              revSharePct: "70",
              status: "active",
            })),
          );
        }
      } catch (err) {
        globalForRegistry.__vasRegistryEnsured = undefined;
        console.error("[registry] seed failed", err);
        throw err;
      }
    })();
  }
  return globalForRegistry.__vasRegistryEnsured;
}
