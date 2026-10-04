import { db, getDeviceId, getHLC } from './db';
import { generateUUIDv7 } from './hlc';
import { OutboxOp } from './types';
import { syncNow } from './syncEngine';

export async function resolveConflict(
  conflictId: string,
  choice: 'KEEP_MINE' | 'KEEP_THEIRS' | 'CUSTOM',
  customValue?: any
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId);
  if (!conflict) return;

  const family = await db.families.get(conflict.entityId);
  if (!family) return;

  let resolvedValue: any;
  if (choice === 'KEEP_MINE') {
    resolvedValue = conflict.clientValue;
  } else if (choice === 'KEEP_THEIRS') {
    resolvedValue = conflict.serverValue;
  } else {
    resolvedValue = customValue;
  }

  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();
  const clock = hlc.now();

  const newVersion = Math.max(conflict.clientVersion, conflict.serverVersion) + 1;
  const updatedFieldVersions = {
    ...family.fieldVersions,
    [conflict.field]: newVersion,
  };

  const updatedFamily = {
    ...family,
    [conflict.field]: resolvedValue,
    fieldVersions: updatedFieldVersions,
    updatedAt: now,
    syncState: 'PENDING' as const,
  };

  const patchOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: clock,
    schemaV: 1,
    entityType: 'family',
    entityId: family.id,
    kind: 'patch',
    baseFieldVersions: {
      [conflict.field]: Math.max(conflict.clientVersion, conflict.serverVersion),
    },
    patch: {
      [conflict.field]: resolvedValue,
    },
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.families, db.conflicts, db.outbox], async () => {
    await db.families.put(updatedFamily);
    await db.conflicts.update(conflictId, {
      status: 'RESOLVED',
      resolvedValue,
    });
    await db.outbox.add(patchOp);
  });

  // Reconcile with server immediately
  try {
    await syncNow();
  } catch (err) {
    console.warn('[ReliefSync] Sync after resolution deferred to next online event:', err);
  }
}

/**
 * Creates a deterministic concurrent collision to demonstrate conflict handling to judges
 */
export async function simulateConflictScenario(): Promise<string> {
  const family = await db.families.filter((f) => !f.isDeleted).first();
  if (!family) {
    throw new Error('No family found in database to simulate conflict on.');
  }

  // 1. Simulate Device B syncing first with Server:
  // We send a direct synthetic patch to the server to advance the server version
  const syntheticServerOp: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId: 'DEV-VOLUNTEER-B',
    hlc: '000000000000000-00001-DEV-VOLUNTEER-B',
    schemaV: 1,
    entityType: 'family',
    entityId: family.id,
    kind: 'patch',
    baseFieldVersions: { headName: family.fieldVersions.headName || 1 },
    patch: { headName: `${family.headName} (Edited by Volunteer B on Server)` },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'DEV-VOLUNTEER-B',
      ops: [syntheticServerOp],
    }),
  });

  // 2. Now Device A (this device) makes a concurrent edit on the same field while still at base version 1
  const deviceId = await getDeviceId();
  const hlc = await getHLC();
  const now = new Date().toISOString();

  const conflictingLocalPatch: OutboxOp = {
    opId: generateUUIDv7(),
    deviceId,
    hlc: hlc.now(),
    schemaV: 1,
    entityType: 'family',
    entityId: family.id,
    kind: 'patch',
    baseFieldVersions: { headName: family.fieldVersions.headName || 1 },
    patch: { headName: `${family.headName} (Edited Locally on Device A)` },
    status: 'PENDING',
    createdAt: now,
  };

  await db.transaction('rw', [db.families, db.outbox], async () => {
    await db.families.update(family.id, {
      headName: `${family.headName} (Edited Locally on Device A)`,
      syncState: 'PENDING',
      updatedAt: now,
    });
    await db.outbox.add(conflictingLocalPatch);
  });

  // 3. Trigger sync: Server detects that server headName was updated by Device B,
  // while Device A's patch is based on the older version. It creates a CONFLICT!
  await syncNow();

  return family.id;
}
