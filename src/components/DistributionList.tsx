'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DistributionList() {
  const distributions = useLiveQuery(() => db.distributions.reverse().toArray(), [], []);
  const families = useLiveQuery(() => db.families.toArray(), [], []);

  const familyMap = new Map<string, string>();
  for (const f of families || []) {
    familyMap.set(f.id, f.headName);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Aid Distribution Log
          </h2>
          <p className="text-xs text-slate-400">
            Immutable distribution history. Handouts with duplicate flags are recorded to preserve ground-truth reality.
          </p>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="divide-y divide-slate-800/80">
          {distributions && distributions.length > 0 ? (
            distributions.map((d) => {
              const familyName = familyMap.get(d.familyId) || `Family #${d.familyId.substring(0, 6)}`;
              const isAnomaly = d.anomaly === 'DOUBLE_IN_ROUND';

              return (
                <div
                  key={d.id}
                  className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                    isAnomaly ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isAnomaly
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isAnomaly ? <AlertTriangle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{familyName}</span>
                        <span className="text-[11px] font-mono text-slate-400">({d.roundId})</span>
                        {isAnomaly && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            ANOMALY: DOUBLE HANDOUT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Received: <span className="font-semibold text-emerald-300">{d.qty}x {d.itemName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        d.syncState === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {d.syncState}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {d.createdAt.substring(11, 16)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              No relief aid distributions recorded yet. Select a family from the Families tab to issue supplies.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
