'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { ConflictRecord } from '@/lib/types';
import { resolveConflict, simulateConflictScenario } from '@/lib/conflictService';
import {
  AlertTriangle,
  ShieldCheck,
  Check,
  ArrowRight,
  GitMerge,
  Sparkles,
  History,
  Smartphone,
  Server,
  Edit2,
  RefreshCw,
} from 'lucide-react';

export default function ConflictInbox() {
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMsg, setSimulationMsg] = useState<string | null>(null);

  // Custom merge state: conflictId -> text
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const conflicts = useLiveQuery(() => db.conflicts.reverse().toArray(), [], []);

  const openConflicts = conflicts?.filter((c) => c.status === 'OPEN') || [];
  const resolvedConflicts = conflicts?.filter((c) => c.status === 'RESOLVED') || [];

  const handleResolve = async (
    conflictId: string,
    choice: 'KEEP_MINE' | 'KEEP_THEIRS' | 'CUSTOM',
    customVal?: string
  ) => {
    try {
      setResolvingId(conflictId);
      await resolveConflict(conflictId, choice, customVal);
      // Clean up custom input if any
      setCustomInputs((prev) => {
        const copy = { ...prev };
        delete copy[conflictId];
        return copy;
      });
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setResolvingId(null);
    }
  };

  const handleTriggerSimulation = async () => {
    try {
      setIsSimulating(true);
      setSimulationMsg(null);
      await simulateConflictScenario();
      setSimulationMsg('✓ Simulated concurrent offline edit! Conflicting record generated below.');
      setTab('open');
    } catch (err: any) {
      setSimulationMsg(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
      setTimeout(() => setSimulationMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Simulation Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            Semantic Conflict Inbox
          </h2>
          <p className="text-xs text-slate-400">
            Detected overlapping offline updates. Non-overlapping fields auto-merged cleanly. Overlapping fields require explicit coordinator choice.
          </p>
        </div>

        {/* Demo trigger button for judges */}
        <button
          onClick={handleTriggerSimulation}
          disabled={isSimulating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-950/40 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>{isSimulating ? 'Simulating Collision...' : 'Simulate Offline Collision'}</span>
        </button>
      </div>

      {simulationMsg && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{simulationMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setTab('open')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'open'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Open Conflicts ({openConflicts.length})</span>
        </button>

        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tab === 'history'
              ? 'bg-slate-800 text-slate-200 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Resolution History ({resolvedConflicts.length})</span>
        </button>
      </div>

      {/* Tab: Open Conflicts */}
      {tab === 'open' && (
        <div className="space-y-4">
          {openConflicts.length > 0 ? (
            openConflicts.map((c) => {
              const isResolving = resolvingId === c.id;
              const hasCustomInput = customInputs[c.id] !== undefined;

              return (
                <div
                  key={c.id}
                  className="bg-slate-800/80 border border-rose-900/60 rounded-2xl p-5 shadow-xl space-y-4"
                >
                  {/* Conflict Card Title */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="font-bold text-white text-sm">
                        Concurrent Collision on Family #{c.entityId.substring(0, 8)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Field: {c.field}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Detected: {c.createdAt.substring(11, 19)}
                    </span>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mine (Local Phone Edit) */}
                    <div className="bg-slate-900/80 border border-sky-500/30 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                            <Smartphone className="w-3.5 h-3.5" />
                            Local Device (Mine)
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            Version {c.clientVersion}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-100 font-medium text-sm font-mono break-all">
                          {String(c.clientValue)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleResolve(c.id, 'KEEP_MINE')}
                        disabled={isResolving}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Keep My Version</span>
                      </button>
                    </div>

                    {/* Theirs (Server / Other Volunteer) */}
                    <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                            <Server className="w-3.5 h-3.5" />
                            Camp Authority / Device B (Theirs)
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Version {c.serverVersion}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70 text-slate-100 font-medium text-sm font-mono break-all">
                          {String(c.serverValue)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleResolve(c.id, 'KEEP_THEIRS')}
                        disabled={isResolving}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Server Version</span>
                      </button>
                    </div>
                  </div>

                  {/* Manual / Custom Merge Option */}
                  <div className="pt-2 border-t border-slate-800">
                    {!hasCustomInput ? (
                      <button
                        onClick={() =>
                          setCustomInputs((prev) => ({
                            ...prev,
                            [c.id]: `${c.clientValue} / ${c.serverValue}`,
                          }))
                        }
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Write custom hybrid merge value...</span>
                      </button>
                    ) : (
                      <div className="space-y-2 mt-2 bg-slate-900/60 p-3 rounded-xl border border-slate-700">
                        <label className="block text-xs font-semibold text-slate-300">
                          Custom Resolution for &quot;{c.field}&quot;:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customInputs[c.id]}
                            onChange={(e) =>
                              setCustomInputs((prev) => ({
                                ...prev,
                                [c.id]: e.target.value,
                              }))
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono"
                          />
                          <button
                            onClick={() =>
                              handleResolve(c.id, 'CUSTOM', customInputs[c.id])
                            }
                            disabled={isResolving}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                          >
                            Apply Custom
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-800 text-slate-400">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="font-bold text-white text-base">Inbox Clear: Zero Conflicts</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                All offline transactions are consistent. Non-overlapping edits were auto-merged without prompt.
              </p>
              <button
                onClick={handleTriggerSimulation}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors inline-flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test & Simulate Conflict Scenario</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Resolution History */}
      {tab === 'history' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg">
          <div className="divide-y divide-slate-800/80">
            {resolvedConflicts.length > 0 ? (
              resolvedConflicts.map((c) => (
                <div key={c.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">Family #{c.entityId.substring(0, 8)}</span>
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {c.field}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        RESOLVED
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Settled Value:{' '}
                      <span className="font-mono text-emerald-300 font-semibold">
                        &quot;{String(c.resolvedValue)}&quot;
                      </span>{' '}
                      (Chosen between &quot;{String(c.clientValue)}&quot; and &quot;{String(c.serverValue)}&quot;)
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono self-end sm:self-center">
                    {c.createdAt.substring(0, 10)} {c.createdAt.substring(11, 19)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No resolved conflicts on record yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
