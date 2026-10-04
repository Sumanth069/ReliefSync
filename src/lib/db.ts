import Dexie, { type Table } from 'dexie';
import { Family, Distribution, StockMovement, OutboxOp, ConflictRecord, MetaItem } from './types';
import { HLC, generateUUIDv7 } from './hlc';

export class ReliefSyncDatabase extends Dexie {
  families!: Table<Family, string>;
  distributions!: Table<Distribution, string>;
  stockMovements!: Table<StockMovement, string>;
  outbox!: Table<OutboxOp, number>;
  conflicts!: Table<ConflictRecord, string>;
  meta!: Table<MetaItem, string>;

  constructor() {
    super('ReliefSyncDB');
    this.version(1).stores({
      families: 'id, campId, headName, syncState, updatedAt',
      distributions: 'id, campId, familyId, roundId, syncState',
      stockMovements: 'id, campId, itemName, syncState',
      outbox: '++localSeq, opId, entityType, entityId, status',
      conflicts: 'id, entityId, status',
      meta: 'key',
    });
  }
}

export const db = new ReliefSyncDatabase();

let cachedDeviceId: string | null = null;
let cachedHlc: HLC | null = null;

export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'SERVER-DEVICE';
  if (cachedDeviceId) return cachedDeviceId;

  const row = await db.meta.get('deviceId');
  if (row && row.value) {
    cachedDeviceId = row.value;
    return cachedDeviceId as string;
  }

  const newId = `DEV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  await db.meta.put({ key: 'deviceId', value: newId });
  cachedDeviceId = newId;
  return newId;
}

export async function getHLC(): Promise<HLC> {
  const deviceId = await getDeviceId();
  if (!cachedHlc) {
    cachedHlc = new HLC(deviceId);
  }
  return cachedHlc;
}

export async function getActiveCamp(): Promise<{ id: string; name: string }> {
  if (typeof window === 'undefined') return { id: 'CAMP-CAUVERY-01', name: 'Cauvery Flood Relief Center #1' };
  const row = await db.meta.get('activeCamp');
  if (row && row.value) {
    return row.value;
  }
  const defaultCamp = {
    id: 'CAMP-CAUVERY-01',
    name: 'Cauvery Flood Relief Center #1'
  };
  await db.meta.put({ key: 'activeCamp', value: defaultCamp });
  return defaultCamp;
}

/**
 * Initializes database with realistic flood camp starter inventory and records if empty
 */
export async function seedInitialCampData(): Promise<void> {
  if (typeof window === 'undefined') return;

  const initialized = await db.meta.get('initialized');
  if (initialized && initialized.value) return;

  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const camp = await getActiveCamp();
  const now = new Date().toISOString();

  // Initial Relief Supplies Stock
  const initialStock = [
    { item: 'Dry Ration Kit (10kg)', qty: 150 },
    { item: 'Drinking Water (20L Can)', qty: 300 },
    { item: 'Thermal Blanket', qty: 200 },
    { item: 'Emergency Medical Kit', qty: 80 },
    { item: 'Infant Milk & Nutrition', qty: 60 },
  ];

  for (const s of initialStock) {
    const clock = hlc.now();
    await db.stockMovements.add({
      id: generateUUIDv7(),
      campId: camp.id,
      itemName: s.item,
      delta: s.qty,
      reason: 'Camp Setup Initial Stocking',
      hlc: clock,
      syncState: 'SYNCED',
      createdAt: now,
    });
  }

  // Initial Sample Registered Families
  const sampleFamilies: Omit<Family, 'id'>[] = [
    {
      campId: camp.id,
      headName: 'Ramesh Kumar',
      phone: '9845012345',
      familySize: 4,
      vulnerabilities: ['ELDERLY'],
      fieldVersions: { headName: 1, phone: 1, familySize: 1 },
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      syncState: 'SYNCED',
    },
    {
      campId: camp.id,
      headName: 'Lakshmi Narayanan',
      phone: '9741298765',
      familySize: 5,
      vulnerabilities: ['PREGNANT', 'INFANT'],
      fieldVersions: { headName: 1, phone: 1, familySize: 1 },
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      syncState: 'SYNCED',
    },
    {
      campId: camp.id,
      headName: 'Anil Deshmukh',
      phone: '9448154321',
      familySize: 3,
      vulnerabilities: ['DISABLED'],
      fieldVersions: { headName: 1, phone: 1, familySize: 1 },
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      syncState: 'SYNCED',
    }
  ];

  for (const f of sampleFamilies) {
    await db.families.add({
      ...f,
      id: generateUUIDv7(),
    });
  }

  await db.meta.put({ key: 'initialized', value: true });
}
