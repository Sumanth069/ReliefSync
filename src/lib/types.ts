export type SyncState = 'LOCAL_ONLY' | 'PENDING' | 'SYNCED' | 'CONFLICT' | 'REJECTED';

export type Vulnerability = 'ELDERLY' | 'PREGNANT' | 'INFANT' | 'DISABLED' | 'MEDICAL_NEED';

export interface Family {
  id: string; // UUIDv7 or client-generated unique ID
  campId: string;
  headName: string;
  phone: string;
  familySize: number;
  vulnerabilities: Vulnerability[];
  fieldVersions: Record<string, number>; // per-field version tracking for 3-way merge
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  syncState: SyncState;
}

export interface Distribution {
  id: string;
  campId: string;
  familyId: string;
  roundId: string; // e.g. 'ROUND-1-RELIEF'
  itemName: string; // e.g. 'Ration Kit', 'Water Cans', 'Blanket'
  qty: number;
  hlc: string;
  anomaly?: 'DOUBLE_IN_ROUND' | null;
  syncState: SyncState;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  campId: string;
  itemName: string;
  delta: number; // positive for restock, negative for issue
  reason: string; // e.g. 'Daily Distribution', 'Relief Convoy Inbound', 'Recount'
  hlc: string;
  syncState: SyncState;
  createdAt: string;
}

export type EntityType = 'family' | 'distribution' | 'stock' | 'conflict';
export type OpKind = 'create' | 'patch' | 'delete' | 'append' | 'resolve';

export interface OutboxOp {
  localSeq?: number; // Auto-incremented locally
  opId: string; // UUIDv7 idempotency key
  deviceId: string;
  hlc: string;
  schemaV: number;
  entityType: EntityType;
  entityId: string;
  kind: OpKind;
  baseFieldVersions?: Record<string, number>;
  patch?: Record<string, any>;
  payload?: any;
  status: 'PENDING' | 'INFLIGHT' | 'DONE' | 'PARKED';
  createdAt: string;
}

export type ConflictKind = 'FIELD' | 'DELETE_EDIT' | 'STOCK_DISCREPANCY';

export interface ConflictRecord {
  id: string;
  campId: string;
  kind: ConflictKind;
  entityType: EntityType;
  entityId: string;
  field: string;
  clientValue: any;
  serverValue: any;
  clientVersion: number;
  serverVersion: number;
  status: 'OPEN' | 'RESOLVED';
  resolvedValue?: any;
  createdAt: string;
}

export interface MetaItem {
  key: string;
  value: any;
}

// Network / API types
export interface SyncPushRequest {
  deviceId: string;
  ops: OutboxOp[];
}

export interface OpResultItem {
  opId: string;
  result: 'APPLIED' | 'MERGED' | 'CONFLICT' | 'ANOMALY' | 'REJECTED';
  conflict?: ConflictRecord;
  detail?: string;
}

export interface SyncPushResponse {
  results: OpResultItem[];
  serverTime: string;
}

export interface ChangeLogItem {
  seq: number;
  campId: string;
  entityType: EntityType;
  entityId: string;
  kind: OpKind;
  data: any;
  at: string;
}

export interface SyncPullResponse {
  changes: ChangeLogItem[];
  nextSeq: number;
  hasMore: boolean;
  serverTime: string;
}
