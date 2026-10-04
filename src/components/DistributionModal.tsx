'use client';

import React, { useState, useEffect } from 'react';
import { Family, Distribution } from '@/lib/types';
import { distributeAid } from '@/lib/familyService';
import { db } from '@/lib/db';
import { X, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DistributionModalProps {
  family: Family | null;
  isOpen: boolean;
  onClose: () => void;
}

const AID_ITEMS = [
  { name: 'Dry Ration Kit (10kg)', defaultQty: 1 },
  { name: 'Drinking Water (20L Can)', defaultQty: 2 },
  { name: 'Thermal Blanket', defaultQty: 2 },
  { name: 'Emergency Medical Kit', defaultQty: 1 },
  { name: 'Infant Milk & Nutrition', defaultQty: 1 },
];

export default function DistributionModal({
  family,
  isOpen,
  onClose,
}: DistributionModalProps) {
  const [selectedItem, setSelectedItem] = useState(AID_ITEMS[0].name);
  const [qty, setQty] = useState(1);
  const [roundId, setRoundId] = useState('ROUND-1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingDistribution, setExistingDistribution] = useState<Distribution | null>(null);

  useEffect(() => {
    if (family && isOpen) {
      // Check if family already received this item in this round
      db.distributions
        .where('familyId')
        .equals(family.id)
        .filter((d) => d.roundId === roundId && d.itemName === selectedItem)
        .first()
        .then((found) => {
          setExistingDistribution(found || null);
        });
    }
  }, [family, isOpen, selectedItem, roundId]);

  if (!isOpen || !family) return null;

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await distributeAid({
        familyId: family.id,
        itemName: selectedItem,
        qty,
        roundId,
      });
      onClose();
    } catch (err) {
      console.error('Failed to record distribution offline:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Distribute Relief Aid</h2>
              <p className="text-xs text-slate-400">
                To: <span className="text-white font-medium">{family.headName}</span> (Size: {family.familySize})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleDistribute} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Relief Item
            </label>
            <select
              value={selectedItem}
              onChange={(e) => {
                setSelectedItem(e.target.value);
                const item = AID_ITEMS.find((i) => i.name === e.target.value);
                if (item) setQty(item.defaultQty);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            >
              {AID_ITEMS.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Relief Round
              </label>
              <select
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
              >
                <option value="ROUND-1">Round 1 (Day 1-2)</option>
                <option value="ROUND-2">Round 2 (Day 3-4)</option>
                <option value="SPECIAL-NEED">Special Need / Emergency</option>
              </select>
            </div>
          </div>

          {/* Anomaly Detection Banner */}
          {existingDistribution && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-200">
                  Duplicate Handout Detected in this Round!
                </p>
                <p className="text-amber-400/90 mt-0.5">
                  This family already received {existingDistribution.qty}x &quot;{selectedItem}&quot; in {roundId}.
                  Recording this will flag a <span className="font-mono font-bold">DOUBLE_IN_ROUND</span> anomaly without discarding the physical handout.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Confirm Handout (Offline)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
