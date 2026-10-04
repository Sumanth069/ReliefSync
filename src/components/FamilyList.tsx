'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Family } from '@/lib/types';
import {
  Users,
  Search,
  UserPlus,
  Edit,
  Gift,
  CloudOff,
  CheckCircle,
  AlertCircle,
  Phone,
  Home,
} from 'lucide-react';
import FamilyRegistrationModal from './FamilyRegistrationModal';
import FamilyEditModal from './FamilyEditModal';
import DistributionModal from './DistributionModal';

const VULN_LABELS: Record<string, { label: string; icon: string }> = {
  ELDERLY: { label: 'Elderly', icon: '👵' },
  PREGNANT: { label: 'Pregnant', icon: '🤰' },
  INFANT: { label: 'Infant', icon: '👶' },
  DISABLED: { label: 'Disabled', icon: '♿' },
  MEDICAL_NEED: { label: 'Medical', icon: '💊' },
};

export default function FamilyList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [distributeFamily, setDistributeFamily] = useState<Family | null>(null);

  // Live query for active families
  const families = useLiveQuery(
    () =>
      db.families
        .filter((f) => !f.isDeleted)
        .reverse()
        .toArray(),
    [],
    []
  );

  const filteredFamilies = families?.filter((f) => {
    const q = searchQuery.toLowerCase();
    return (
      f.headName.toLowerCase().includes(q) ||
      (f.phone && f.phone.includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search families by name or phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <button
          onClick={() => setIsRegisterOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-600/25"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Family (Offline)</span>
        </button>
      </div>

      {/* Family Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFamilies && filteredFamilies.length > 0 ? (
          filteredFamilies.map((family) => {
            return (
              <div
                key={family.id}
                className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all shadow-md hover:shadow-lg hover:shadow-slate-900/50"
              >
                <div>
                  {/* Card Header & Sync State */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug">
                        {family.headName}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Home className="w-3 h-3 text-slate-500" />
                          {family.familySize} Members
                        </span>
                        {family.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {family.phone}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Per-card sync badge */}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                        family.syncState === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : family.syncState === 'CONFLICT'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {family.syncState === 'PENDING' ? (
                        <>
                          <CloudOff className="w-3 h-3 text-amber-400" />
                          <span>QUEUED</span>
                        </>
                      ) : family.syncState === 'CONFLICT' ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span>CONFLICT</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span>SYNCED</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Vulnerabilities */}
                  {family.vulnerabilities && family.vulnerabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {family.vulnerabilities.map((v) => {
                        const info = VULN_LABELS[v];
                        return (
                          <span
                            key={v}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900/60 text-slate-300 border border-slate-700/60 flex items-center gap-1"
                          >
                            <span>{info?.icon || '•'}</span>
                            <span>{info?.label || v}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => setDistributeFamily(family)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Issue Aid</span>
                  </button>

                  <button
                    onClick={() => setEditingFamily(family)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 text-center bg-slate-800/40 rounded-2xl border border-slate-800 text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No registered families found</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Register Family (Offline)&quot; to add the first family to this camp.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <FamilyRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
      />
      <FamilyEditModal
        family={editingFamily}
        isOpen={!!editingFamily}
        onClose={() => setEditingFamily(null)}
      />
      <DistributionModal
        family={distributeFamily}
        isOpen={!!distributeFamily}
        onClose={() => setDistributeFamily(null)}
      />
    </div>
  );
}
