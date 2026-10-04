import {
  Family,
  Distribution,
  StockMovement,
  OutboxOp,
  OpResultItem,
  ChangeLogItem,
  ConflictRecord,
} from './types';
import { generateUUIDv7 } from './hlc';

// In-memory server store for demonstration & testing
interface ServerState {
  globalSeq: number;
  families: Map<string, Family>;
  distributions: Distribution[];
  stockMovements: StockMovement[];
  opLog: Map<string, OpResultItem>;
  changeLog: ChangeLogItem[];
}

const state: ServerState = {
  globalSeq: 0,
  families: new Map(),
  distributions: [],
  stockMovements: [],
  opLog: new Map(),
  changeLog: [],
};

// Initialize server with base camp data
let initialized = false;
export function initServerState() {
  if (initialized) return;
  initialized = true;

  const now = new Date().toISOString();
  const initialStock = [
    { item: 'Dry Ration Kit (10kg)', qty: 150 },
    { item: 'Drinking Water (20L Can)', qty: 300 },
    { item: 'Thermal Blanket', qty: 200 },
    { item: 'Emergency Medical Kit', qty: 80 },
    { item: 'Infant Milk & Nutrition', qty: 60 },
  ];

  for (const s of initialStock) {
    state.stockMovements.push({
      id: generateUUIDv7(),
      campId: 'CAMP-CAUVERY-01',
      itemName: s.item,
      delta: s.qty,
      reason: 'Camp Setup Initial Stocking',
      hlc: '000000000000000-00000-SERVER',
      syncState: 'SYNCED',
      createdAt: now,
    });
  }
}

export function getServerChangeLog(since: number): { changes: ChangeLogItem[]; nextSeq: number } {
  initServerState();
  const filtered = state.changeLog.filter((c) => c.seq > since);
  return {
    changes: filtered,
    nextSeq: state.globalSeq,
  };
}

export function processServerOp(op: OutboxOp): OpResultItem {
  initServerState();

  // 1. Idempotency Check
  if (state.opLog.has(op.opId)) {
    return state.opLog.get(op.opId)!;
  }

  const now = new Date().toISOString();
  let outcome: OpResultItem = { opId: op.opId, result: 'APPLIED' };

  if (op.entityType === 'family') {
    if (op.kind === 'create') {
      const family: Family = {
        ...op.payload,
        syncState: 'SYNCED',
      };
      state.families.set(op.entityId, family);

      state.globalSeq++;
      state.changeLog.push({
        seq: state.globalSeq,
        campId: family.campId,
        entityType: 'family',
        entityId: family.id,
        kind: 'create',
        data: family,
        at: now,
      });
      outcome = { opId: op.opId, result: 'APPLIED' };
    } else if (op.kind === 'patch') {
      const serverFamily = state.families.get(op.entityId);

      if (!serverFamily) {
        outcome = { opId: op.opId, result: 'REJECTED', detail: 'Family not found on server' };
      } else {
        const baseVersions = op.baseFieldVersions || {};
        const patch = op.patch || {};
        let hasConflict = false;
        let conflictRecord: ConflictRecord | undefined;

        const mergedPatch: Record<string, any> = {};
        const updatedVersions = { ...serverFamily.fieldVersions };

        for (const [field, clientVal] of Object.entries(patch)) {
          const clientBaseVersion = baseVersions[field] || 1;
          const serverCurrentVersion = serverFamily.fieldVersions[field] || 1;
          const serverCurrentVal = (serverFamily as any)[field];

          // Collision Detection: server has been modified beyond client's base AND values differ
          if (serverCurrentVersion > clientBaseVersion && JSON.stringify(serverCurrentVal) !== JSON.stringify(clientVal)) {
            hasConflict = true;
            conflictRecord = {
              id: generateUUIDv7(),
              campId: serverFamily.campId,
              kind: 'FIELD',
              entityType: 'family',
              entityId: serverFamily.id,
              field,
              clientValue: clientVal,
              serverValue: serverCurrentVal,
              clientVersion: clientBaseVersion,
              serverVersion: serverCurrentVersion,
              status: 'OPEN',
              createdAt: now,
            };
            // Never silently overwrite: server keeps its value until human resolution
          } else {
            // Safe to merge
            mergedPatch[field] = clientVal;
            updatedVersions[field] = Math.max(serverCurrentVersion, clientBaseVersion) + 1;
          }
        }

        if (hasConflict && conflictRecord) {
          outcome = {
            opId: op.opId,
            result: 'CONFLICT',
            conflict: conflictRecord,
            detail: `Concurrent overlapping update detected on field '${conflictRecord.field}'`,
          };
        } else {
          // Clean auto-merge
          const updatedFamily: Family = {
            ...serverFamily,
            ...mergedPatch,
            fieldVersions: updatedVersions,
            updatedAt: now,
            syncState: 'SYNCED',
          };
          state.families.set(op.entityId, updatedFamily);

          state.globalSeq++;
          state.changeLog.push({
            seq: state.globalSeq,
            campId: updatedFamily.campId,
            entityType: 'family',
            entityId: updatedFamily.id,
            kind: 'patch',
            data: updatedFamily,
            at: now,
          });
          outcome = { opId: op.opId, result: 'MERGED' };
        }
      }
    } else if (op.kind === 'delete') {
      const serverFamily = state.families.get(op.entityId);
      if (serverFamily) {
        const deletedFamily = { ...serverFamily, isDeleted: true, updatedAt: now };
        state.families.set(op.entityId, deletedFamily);

        state.globalSeq++;
        state.changeLog.push({
          seq: state.globalSeq,
          campId: serverFamily.campId,
          entityType: 'family',
          entityId: serverFamily.id,
          kind: 'delete',
          data: deletedFamily,
          at: now,
        });
      }
      outcome = { opId: op.opId, result: 'APPLIED' };
    }
  } else if (op.entityType === 'distribution') {
    const dist: Distribution = {
      ...op.payload,
      syncState: 'SYNCED',
    };
    state.distributions.push(dist);

    state.globalSeq++;
    state.changeLog.push({
      seq: state.globalSeq,
      campId: dist.campId,
      entityType: 'distribution',
      entityId: dist.id,
      kind: 'append',
      data: dist,
      at: now,
    });
    outcome = {
      opId: op.opId,
      result: dist.anomaly ? 'ANOMALY' : 'APPLIED',
      detail: dist.anomaly ? 'Duplicate handout in round recorded as anomaly' : undefined,
    };
  } else if (op.entityType === 'stock') {
    const movement: StockMovement = {
      ...op.payload,
      syncState: 'SYNCED',
    };
    state.stockMovements.push(movement);

    state.globalSeq++;
    state.changeLog.push({
      seq: state.globalSeq,
      campId: movement.campId,
      entityType: 'stock',
      entityId: movement.id,
      kind: 'append',
      data: movement,
      at: now,
    });
    outcome = { opId: op.opId, result: 'APPLIED' };
  }

  // Cache op outcome for idempotency
  state.opLog.set(op.opId, outcome);
  return outcome;
}
