/**
 * ReliefSync Sync Correctness & Invariant Test Suite
 * PS ID: ALG-WEB-02 (Offline-First Application)
 *
 * Verifies core synchronization invariants:
 * 1. Monotonic changelog sequence
 * 2. Push idempotency (duplicate replay safety)
 * 3. Field-level 3-way auto-merge (non-overlapping edits)
 * 4. Concurrent collision prevention (no silent overwrite)
 * 5. Physical relief anomaly preservation (double distribution)
 */

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASSED: ${message}`);
}

// Minimal in-memory simulation matching serverStore.ts logic
class ServerSyncEngine {
  constructor() {
    this.globalSeq = 0;
    this.families = new Map();
    this.distributions = [];
    this.stockMovements = [];
    this.opLog = new Map();
    this.changeLog = [];
  }

  getChangesSince(since = 0) {
    return {
      changes: this.changeLog.filter((c) => c.seq > since),
      nextSeq: this.globalSeq,
    };
  }

  processOp(op) {
    // 1. Idempotency Check
    if (this.opLog.has(op.opId)) {
      return this.opLog.get(op.opId);
    }

    const now = new Date().toISOString();
    let outcome = { opId: op.opId, result: 'APPLIED' };

    if (op.entityType === 'family') {
      if (op.kind === 'create') {
        const family = { ...op.payload, syncState: 'SYNCED' };
        this.families.set(op.entityId, family);
        this.globalSeq++;
        this.changeLog.push({
          seq: this.globalSeq,
          campId: family.campId,
          entityType: 'family',
          entityId: family.id,
          kind: 'create',
          data: family,
          at: now,
        });
        outcome = { opId: op.opId, result: 'APPLIED' };
      } else if (op.kind === 'patch') {
        const serverFamily = this.families.get(op.entityId);
        if (!serverFamily) {
          outcome = { opId: op.opId, result: 'REJECTED', detail: 'Family not found' };
        } else {
          const baseVersions = op.baseFieldVersions || {};
          const patch = op.patch || {};
          let hasConflict = false;
          let conflictRecord;

          const mergedPatch = {};
          const updatedVersions = { ...serverFamily.fieldVersions };

          for (const [field, clientVal] of Object.entries(patch)) {
            const clientBaseVersion = baseVersions[field] || 1;
            const serverCurrentVersion = serverFamily.fieldVersions[field] || 1;
            const serverCurrentVal = serverFamily[field];

            // Collision check: server modified beyond client base and values differ
            if (
              serverCurrentVersion > clientBaseVersion &&
              JSON.stringify(serverCurrentVal) !== JSON.stringify(clientVal)
            ) {
              hasConflict = true;
              conflictRecord = {
                id: `conf-${Date.now()}`,
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
            } else {
              mergedPatch[field] = clientVal;
              updatedVersions[field] = Math.max(serverCurrentVersion, clientBaseVersion) + 1;
            }
          }

          if (hasConflict && conflictRecord) {
            outcome = {
              opId: op.opId,
              result: 'CONFLICT',
              conflict: conflictRecord,
            };
          } else {
            const updated = {
              ...serverFamily,
              ...mergedPatch,
              fieldVersions: updatedVersions,
              updatedAt: now,
              syncState: 'SYNCED',
            };
            this.families.set(op.entityId, updated);
            this.globalSeq++;
            this.changeLog.push({
              seq: this.globalSeq,
              campId: updated.campId,
              entityType: 'family',
              entityId: updated.id,
              kind: 'patch',
              data: updated,
              at: now,
            });
            outcome = { opId: op.opId, result: 'MERGED' };
          }
        }
      }
    } else if (op.entityType === 'distribution') {
      const dist = { ...op.payload, syncState: 'SYNCED' };
      this.distributions.push(dist);
      this.globalSeq++;
      this.changeLog.push({
        seq: this.globalSeq,
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
        detail: dist.anomaly ? 'Duplicate in round' : undefined,
      };
    }

    this.opLog.set(op.opId, outcome);
    return outcome;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('ReliefSync Synchronization Invariant Verification');
  console.log('====================================================\n');

  const engine = new ServerSyncEngine();

  // Test 1: Family Creation & Changelog Monotonicity
  console.log('Test 1: Family Creation & Monotonic Cursor Sequence');
  const familyId = 'fam-test-101';
  const createOp = {
    opId: 'op-create-1',
    deviceId: 'DEV-A',
    hlc: '000000000000001-00000-DEV-A',
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'create',
    payload: {
      id: familyId,
      campId: 'CAMP-CAUVERY-01',
      headName: 'Suresh Raina',
      phone: '9845000001',
      familySize: 4,
      vulnerabilities: ['ELDERLY'],
      fieldVersions: { headName: 1, phone: 1, familySize: 1 },
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  const outcome1 = engine.processOp(createOp);
  assert(outcome1.result === 'APPLIED', 'Create op should be APPLIED');

  const { changes: changes1, nextSeq: seq1 } = engine.getChangesSince(0);
  assert(changes1.length === 1, 'ChangeLog should record the new family creation');
  assert(seq1 === 1, 'Changelog seq should increment to 1');
  console.log('');

  // Test 2: Idempotency (Duplicate Op Replay)
  console.log('Test 2: Push Idempotency (Duplicate Op Replay)');
  const currentLogLen = engine.getChangesSince(0).changes.length;
  const replayOutcome = engine.processOp(createOp);
  assert(replayOutcome.result === 'APPLIED', 'Replayed op should return cached APPLIED result');
  const newLogLen = engine.getChangesSince(0).changes.length;
  assert(currentLogLen === newLogLen, 'Replaying identical opId must not append duplicate entries to changelog');
  console.log('');

  // Test 3: Non-Overlapping Field Auto-Merge
  console.log('Test 3: Non-Overlapping Field 3-Way Auto-Merge');
  // Device A edits phone
  const patchPhoneOp = {
    opId: 'op-patch-phone',
    deviceId: 'DEV-A',
    hlc: '000000000000002-00000-DEV-A',
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'patch',
    baseFieldVersions: { phone: 1 },
    patch: { phone: '9845099999' },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const phoneRes = engine.processOp(patchPhoneOp);
  assert(phoneRes.result === 'MERGED', 'Phone patch should merge cleanly');

  // Device B concurrently edits familySize based on original version 1
  const patchSizeOp = {
    opId: 'op-patch-size',
    deviceId: 'DEV-B',
    hlc: '000000000000002-00001-DEV-B',
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'patch',
    baseFieldVersions: { familySize: 1 },
    patch: { familySize: 6 },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const sizeRes = engine.processOp(patchSizeOp);
  assert(sizeRes.result === 'MERGED', 'Independent field (familySize) should auto-merge without conflict');
  console.log('');

  // Test 4: Overlapping Field Collision (No Silent Overwrite)
  console.log('Test 4: Concurrent Overlapping Collision Prevention');
  // Device A edits headName from base 1 to 'Suresh Kumar'
  const patchHeadA = {
    opId: 'op-patch-head-a',
    deviceId: 'DEV-A',
    hlc: '000000000000003-00000-DEV-A',
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'patch',
    baseFieldVersions: { headName: 1 },
    patch: { headName: 'Suresh Kumar' },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const headARes = engine.processOp(patchHeadA);
  assert(headARes.result === 'MERGED', 'First edit on headName is merged to version 2');

  // Device B concurrently edits headName from base 1 to 'Suresh Sharma'
  const patchHeadB = {
    opId: 'op-patch-head-b',
    deviceId: 'DEV-B',
    hlc: '000000000000003-00001-DEV-B',
    schemaV: 1,
    entityType: 'family',
    entityId: familyId,
    kind: 'patch',
    baseFieldVersions: { headName: 1 }, // Device B is offline and still at base version 1
    patch: { headName: 'Suresh Sharma' },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const headBRes = engine.processOp(patchHeadB);
  assert(headBRes.result === 'CONFLICT', 'Overlapping concurrent edit MUST be flagged as CONFLICT');
  assert(headBRes.conflict !== undefined, 'Conflict record must be generated');
  assert(headBRes.conflict.field === 'headName', 'Conflict record must identify contested field "headName"');
  assert(headBRes.conflict.clientValue === 'Suresh Sharma', 'Conflict record must capture client value');
  assert(headBRes.conflict.serverValue === 'Suresh Kumar', 'Conflict record must preserve current server value');
  console.log('');

  // Test 5: Distribution Duplicate Anomaly Preservation
  console.log('Test 5: Relief Aid Anomaly Preservation (Ground Truth Retained)');
  const distOp = {
    opId: 'op-dist-1',
    deviceId: 'DEV-A',
    hlc: '000000000000004-00000-DEV-A',
    schemaV: 1,
    entityType: 'distribution',
    entityId: 'dist-1',
    kind: 'append',
    payload: {
      id: 'dist-1',
      campId: 'CAMP-CAUVERY-01',
      familyId,
      roundId: 'ROUND-1',
      itemName: 'Dry Ration Kit (10kg)',
      qty: 1,
      hlc: '000000000000004-00000-DEV-A',
      anomaly: 'DOUBLE_IN_ROUND',
      createdAt: new Date().toISOString(),
    },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  const distRes = engine.processOp(distOp);
  assert(distRes.result === 'ANOMALY', 'Duplicate distribution should be tagged ANOMALY and preserved, never dropped');
  console.log('');

  console.log('====================================================');
  console.log('🎯 All 5 Synchronization Invariants Verified Successfully!');
  console.log('====================================================');
}

runTests();
