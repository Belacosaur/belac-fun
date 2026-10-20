import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ledgerEntries, ledgerEvents, sourceRecords } from "./schema.js";

type Database = NodePgDatabase;

type SourceRecordInsert = typeof sourceRecords.$inferInsert;
type LedgerEventInsert = typeof ledgerEvents.$inferInsert;
type LedgerEntryInsert = typeof ledgerEntries.$inferInsert;

export async function insertSourceRecord(db: Database, values: SourceRecordInsert) {
  return db.insert(sourceRecords).values(values).returning();
}

export async function selectSourceRecords(db: Database, challengeId: string) {
  return db.select().from(sourceRecords).where(eq(sourceRecords.challengeId, challengeId));
}

export async function insertLedgerEvent(db: Database, values: LedgerEventInsert) {
  return db.insert(ledgerEvents).values(values).returning();
}

export async function selectLedgerEvents(db: Database, challengeId: string) {
  return db.select().from(ledgerEvents).where(eq(ledgerEvents.challengeId, challengeId));
}

export async function insertLedgerEntry(db: Database, values: LedgerEntryInsert) {
  return db.insert(ledgerEntries).values(values).returning();
}

export async function selectLedgerEntries(db: Database, eventId: string) {
  return db.select().from(ledgerEntries).where(eq(ledgerEntries.eventId, eventId));
}
