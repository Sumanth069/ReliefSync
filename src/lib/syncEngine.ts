import { db, getDeviceId } from './db';
import { SyncPushRequest, SyncPushResponse, SyncPullResponse } from './types';

let isSyncRunning = false;

export async function pushOutbox(): Promise<{ pushed: number; conflicts: number }> {
  const deviceId = await getDeviceId();
  const pendingOps = await db.outbox.where('status').equals('PENDING').toArray();

  if (pendingOps.length === 0) {
    return { pushed: 0, conflicts: 0 };
  }

  // Mark inflight
  for (const op of pendingOps) {
    if (op.localSeq !== undefined) {
      await db.outbox.update(op.localSeq, { status: 'INFLIGHT' });
    }
  }

  try {
    const payload: SyncPushRequest = {
      deviceId,
      ops: pendingOps,
    };

    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Sync push HTTP error: ${res.status}`);
    }

    const data: SyncPushResponse = await res.json();
    let pushedCount = 0;
    let conflictCount = 0;

    for (const item of data.results) {
      const matchedOp = pendingOps.find((o) => o.opId === item.opId);
      if (!matchedOp || matchedOp.localSeq === undefined) continue;

      if (item.result === 'APPLIED' || item.result === 'MERGED' || item.result === 'ANOMALY') {
        pushedCount++;
        await db.outbox.update(matchedOp.localSeq, { status: 'DONE' });

        // Update corresponding local entity to SYNCED
        if (matchedOp.entityType === 'family') {
          await db.families.update(matchedOp.entityId, { syncState: 'SYNCED' });
        } else if (matchedOp.entityType === 'distribution') {
          await db.distributions.update(matchedOp.entityId, { syncState: 'SYNCED' });
        } else if (matchedOp.entityType === 'stock') {
          await db.stockMovements.update(matchedOp.entityId, { syncState: 'SYNCED' });
        }
      } else if (item.result === 'CONFLICT') {
        conflictCount++;
        await db.outbox.update(matchedOp.localSeq, { status: 'PARKED' });

        if (item.conflict) {
          await db.conflicts.put(item.conflict);
        }

        if (matchedOp.entityType === 'family') {
          await db.families.update(matchedOp.entityId, { syncState: 'CONFLICT' });
        }
      } else if (item.result === 'REJECTED') {
        await db.outbox.update(matchedOp.localSeq, { status: 'PARKED' });
        if (matchedOp.entityType === 'family') {
          await db.families.update(matchedOp.entityId, { syncState: 'REJECTED' });
        }
      }
    }

    return { pushed: pushedCount, conflicts: conflictCount };
  } catch (err) {
    // If network fails during push, revert INFLIGHT ops back to PENDING
    for (const op of pendingOps) {
      if (op.localSeq !== undefined) {
        await db.outbox.update(op.localSeq, { status: 'PENDING' });
      }
    }
    throw err;
  }
}

export async function pullChanges(): Promise<{ pulled: number }> {
  const metaSeq = await db.meta.get('lastPullSeq');
  const since = metaSeq?.value || 0;

  try {
    const res = await fetch(`/api/sync/pull?since=${since}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Sync pull HTTP error: ${res.status}`);
    }

    const data: SyncPullResponse = await res.json();
    const changes = data.changes || [];

    if (changes.length > 0) {
      await db.transaction('rw', [db.families, db.distributions, db.stockMovements], async () => {
        for (const ch of changes) {
          if (ch.entityType === 'family') {
            const local = await db.families.get(ch.entityId);
            // If local family doesn't have pending edits, update with server version
            if (!local || local.syncState !== 'PENDING') {
              await db.families.put({
                ...ch.data,
                syncState: 'SYNCED',
              });
            }
          } else if (ch.entityType === 'distribution') {
            const local = await db.distributions.get(ch.entityId);
            if (!local) {
              await db.distributions.put({
                ...ch.data,
                syncState: 'SYNCED',
              });
            }
          } else if (ch.entityType === 'stock') {
            const local = await db.stockMovements.get(ch.entityId);
            if (!local) {
              await db.stockMovements.put({
                ...ch.data,
                syncState: 'SYNCED',
              });
            }
          }
        }
      });
    }

    await db.meta.put({ key: 'lastPullSeq', value: data.nextSeq });
    return { pulled: changes.length };
  } catch (err) {
    console.warn('[ReliefSync] Pull error:', err);
    throw err;
  }
}

export async function syncNow(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
  if (isSyncRunning) return { pushed: 0, pulled: 0, conflicts: 0 };
  isSyncRunning = true;

  try {
    const pushResult = await pushOutbox();
    const pullResult = await pullChanges();
    return {
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      conflicts: pushResult.conflicts,
    };
  } finally {
    isSyncRunning = false;
  }
}
