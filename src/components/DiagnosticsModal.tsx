'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getDeviceId, getHLC, seedInitialCampData } from '@/lib/db';
import { X, Activity, Database, HardDrive, RefreshCcw, Layers, Terminal, Trash2 } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiagnosticsModal({ isOpen, onClose }: DiagnosticsModalProps) {
  const [deviceId, setDeviceId] = useState('...');
  const [currentHlc, setCurrentHlc] = useState('...');
  const [storageEstimate, setStorageEstimate] = useState<string>('Computing...');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getDeviceId().then(setDeviceId);
      getHLC().then((hlc) => setCurrentHlc(hlc.now()));

      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          const usedMb = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
          const quotaMb = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
          setStorageEstimate(`${usedMb} MB used / ~${quotaMb} MB available`);
        });
      }
    }
  }, [isOpen]);

  const outboxOps = useLiveQuery(() => db.outbox.reverse().limit(25).toArray(), [isOpen], []);
  const metaRows = useLiveQuery(() => db.meta.toArray(), [isOpen], []);

  if (!isOpen) return null;

  const handleResetDatabase = async () => {
    if (!confirm('Reset local camp database back to starter seed? All pending unsynced changes will be wiped.')) {
      return;
    }
    try {
      setIsResetting(true);
      await db.families.clear();
      await db.distributions.clear();
      await db.stockMovements.clear();
      await db.outbox.clear();
      await db.conflicts.clear();
      await db.meta.clear();
      await seedInitialCampData();
      onClose();
    } catch (err) {
      console.error('Failed to reset DB:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Diagnostics & Sync Outbox Inspector</h2>
              <p className="text-xs text-slate-400">Low-level engine state, HLC clock, and IndexedDB ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                Device Node ID
              </span>
              <p className="font-mono text-sm font-bold text-white">{deviceId}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                Hybrid Logical Clock
              </span>
              <p className="font-mono text-xs font-bold text-slate-200 truncate" title={currentHlc}>
                {currentHlc}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                Storage Quota
              </span>
              <p className="text-xs font-bold text-slate-200">{storageEstimate}</p>
            </div>
          </div>

          {/* Outbox Ops Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Recent Mutations in Outbox Queue ({outboxOps?.length || 0})
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Top 25 items</span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Op ID</th>
                    <th className="py-2 px-3">Entity</th>
                    <th className="py-2 px-3">Kind</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {outboxOps && outboxOps.length > 0 ? (
                    outboxOps.map((op) => (
                      <tr key={op.opId} className="hover:bg-slate-900/60">
                        <td className="py-2 px-3 text-slate-500">{op.localSeq}</td>
                        <td className="py-2 px-3 text-slate-300">{op.opId.substring(0, 10)}...</td>
                        <td className="py-2 px-3 text-sky-400 font-semibold">{op.entityType}</td>
                        <td className="py-2 px-3 text-slate-300">{op.kind}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              op.status === 'DONE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : op.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-300'
                                : op.status === 'PARKED'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {op.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px]">
                          {op.createdAt.substring(11, 19)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                        Outbox queue is empty. No mutations recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Meta Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-white text-sm">IndexedDB Meta Registry</h3>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              {metaRows?.map((m) => (
                <div key={m.key} className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">{m.key}</span>
                  <span className="text-slate-300 font-semibold truncate block">
                    {typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex items-center justify-between">
          <button
            onClick={handleResetDatabase}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
