import { db, getDeviceId, getHLC, getActiveCamp } from './db';
import { Family, Distribution, StockMovement, OutboxOp, Vulnerability } from './types';
import { generateUUIDv7 } from './hlc';

export async function registerFamily(input: {
  headName: string;
  phone: string;
  familySize: number;
  vulnerabilities: Vulnerability[];
}): Promise<Family> {
  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const camp = await getActiveCamp();
  const now = new Date().toISOString();
  const familyId = generateUUIDv7();
  const clock = hlc.now();

  const newFamily: Family = {
    id: familyId,
    campId: camp.id,
    headName: input.headName.trim(),
    phone: input.phone.trim(),
    familySize: input.familySize,
    vulnerabilities: input.vulnerabilities,
    fieldVersions: {
      headName: 1,
      phone: 1,
      familySize: 1,
      vulnerabilities: 1,
    },
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    syncState: 'PENDING',
  };

  const outboxOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'create',
    payload: newFamily,
    status: 'PENDING',
    createdAt: now,
  };

  // Atomic local transaction
  await db.transaction('rw', [db.families, db.outbox], async () => {
    await db.families.add(newFamily);
    await db.outbox.add(outboxOp);
  });

  return newFamily;
}

export async function updateFamily(
  familyId: string,
  patch: Partial<Pick<Family, 'headName' | 'phone' | 'familySize' | 'vulnerabilities'>>
): Promise<Family | null> {
  const family = await db.families.get(familyId);
  if (!family) return null;

  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();
  const clock = hlc.now();

  const updatedFieldVersions = { ...family.fieldVersions };
  const baseFieldVersions: Record<string, number> = {};

  // Track updated versions and base versions for 3-way merge
  for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
    baseFieldVersions[key] = family.fieldVersions[key] || 1;
    updatedFieldVersions[key] = (family.fieldVersions[key] || 1) + 1;
  }

  const updatedFamily: Family = {
    ...family,
    ...patch,
    fieldVersions: updatedFieldVersions,
    updatedAt: now,
    syncState: 'PENDING',
  };

  const outboxOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'patch',
    baseFieldVersions,
    patch,
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.families, db.outbox], async () => {
    await db.families.put(updatedFamily);
    await db.outbox.add(outboxOp);
  });

  return updatedFamily;
}

export async function deleteFamily(familyId: string): Promise<void> {
  const family = await db.families.get(familyId);
  if (!family) return;

  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();
  const clock = hlc.now();

  const updatedFamily: Family = {
    ...family,
    isDeleted: true,
    updatedAt: now,
    syncState: 'PENDING',
  };

  const outboxOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'delete',
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.families, db.outbox], async () => {
    await db.families.put(updatedFamily);
    await db.outbox.add(outboxOp);
  });
}

export async function distributeAid(input: {
  familyId: string;
  itemName: string;
  qty: number;
  roundId?: string;
}): Promise<Distribution> {
  const roundId = input.roundId || 'ROUND-1';
  const camp = await getActiveCamp();
  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();
  const clock = hlc.now();

  // Check if family already received this item in this round locally
  const prior = await db.distributions
    .where('familyId')
    .equals(input.familyId)
    .filter((d) => d.roundId === roundId && d.itemName === input.itemName)
    .first();

  const anomaly = prior ? ('DOUBLE_IN_ROUND' as const) : null;

  const distribution: Distribution = {
    id: generateUUIDv7(),
    campId: camp.id,
    familyId: input.familyId,
    roundId,
    itemName: input.itemName,
    qty: input.qty,
    hlc: clock,
    anomaly,
    syncState: 'PENDING',
    createdAt: now,
  };

  const stockMovement: StockMovement = {
    id: generateUUIDv7(),
    campId: camp.id,
    itemName: input.itemName,
    delta: -input.qty, // negative delta for issue
    reason: `Aid Distribution to Family #${input.familyId.substring(0, 6)}`,
    hlc: clock,
    syncState: 'PENDING',
    createdAt: now,
  };

  const distOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'distribution',
    entityId: distribution.id,
    kind: 'append',
    payload: distribution,
    status: 'PENDING',
    createdAt: now,
  };

  const stockOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'stock',
    entityId: stockMovement.id,
    kind: 'append',
    payload: stockMovement,
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.distributions, db.stockMovements, db.outbox], async () => {
    await db.distributions.add(distribution);
    await db.stockMovements.add(stockMovement);
    await db.outbox.add(distOp);
    await db.outbox.add(stockOp);
  });

  return distribution;
}

export async function recordStockAdjustment(
  itemName: string,
  delta: number,
  reason: string
): Promise<StockMovement> {
  const camp = await getActiveCamp();
  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();
  const clock = hlc.now();

  const stockMovement: StockMovement = {
    id: generateUUIDv7(),
    campId: camp.id,
    itemName,
    delta,
    reason,
    hlc: clock,
    syncState: 'PENDING',
    createdAt: now,
  };

  const stockOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'stock',
    entityId: stockMovement.id,
    kind: 'append',
    payload: stockMovement,
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.stockMovements, db.outbox], async () => {
    await db.stockMovements.add(stockMovement);
    await db.outbox.add(stockOp);
  });

  return stockMovement;
}
