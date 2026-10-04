'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { recordStockAdjustment } from '@/lib/familyService';
import { Layers, PlusCircle, AlertOctagon, TrendingDown, TrendingUp, History } from 'lucide-react';

export default function StockView() {
  const [selectedItem, setSelectedItem] = useState('Dry Ration Kit (10kg)');
  const [delta, setDelta] = useState(50);
  const [reason, setReason] = useState('District Relief Convoy Arrival');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Live query for all stock movements
  const movements = useLiveQuery(() => db.stockMovements.reverse().toArray(), [], []);

  // Compute live ledger balances
  const balances: Record<string, number> = {};
  for (const m of movements || []) {
    balances[m.itemName] = (balances[m.itemName] || 0) + m.delta;
  }

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === 0) return;
    try {
      setIsSubmitting(true);
      await recordStockAdjustment(selectedItem, delta, reason);
      setShowAdjustModal(false);
      setDelta(50);
      setReason('District Relief Convoy Arrival');
    } catch (err) {
      console.error('Failed to adjust stock:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-400" />
            Camp Supplies & Stock Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Commutative ledger deltas. Negative balances flag discrepancy reviews without rejecting hands-on aid.
          </p>
        </div>
        <button
          onClick={() => setShowAdjustModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-md shadow-sky-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Restock / Adjust Inventory</span>
        </button>
      </div>

      {/* Stock Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(balances).map(([itemName, balance]) => {
          const isNegative = balance < 0;
          const isLow = balance >= 0 && balance < 25;

          return (
            <div
              key={itemName}
              className={`p-5 rounded-2xl border transition-all ${
                isNegative
                  ? 'bg-rose-950/20 border-rose-800/80 shadow-rose-950/20'
                  : isLow
                  ? 'bg-amber-950/20 border-amber-800/60 shadow-amber-950/20'
                  : 'bg-slate-800/80 border-slate-700/60 shadow-slate-900/40'
              } shadow-lg`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">{itemName}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Camp Cauvery Stock</p>
                </div>
                {isNegative ? (
                  <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <AlertOctagon className="w-4 h-4" />
                  </span>
                ) : balance > 50 ? (
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <div
                    className={`text-3xl font-extrabold tracking-tight ${
                      isNegative
                        ? 'text-rose-400'
                        : isLow
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {balance}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    {isNegative
                      ? '⚠️ Negative Balance (Discrepancy)'
                      : isLow
                      ? '⚡ Low Stock Alert'
                      : '✓ Normal Inventory'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Movement Ledger Audit Log */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
        <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-sky-400" />
          Recent Ledger Movements (Audit Trail)
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {movements?.slice(0, 15).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-2 py-0.5 rounded font-mono font-bold ${
                    m.delta > 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                <div>
                  <p className="font-semibold text-slate-200">{m.itemName}</p>
                  <p className="text-[10px] text-slate-400">{m.reason}</p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    m.syncState === 'PENDING'
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {m.syncState}
                </span>
                <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
                  {m.createdAt.substring(11, 19)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-1">Restock or Adjust Inventory</h3>
            <p className="text-xs text-slate-400 mb-4">
              Positive delta adds stock, negative delta logs spoiled/lost goods.
            </p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Relief Item
                </label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm"
                >
                  {Object.keys(balances).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quantity Delta (+ / -)
                </label>
                <input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason / Source
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
                >
                  {isSubmitting ? 'Recording...' : 'Record Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
