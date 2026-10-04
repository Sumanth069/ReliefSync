'use client';

import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getDeviceId } from '@/lib/db';
import { ConnectivityStatus } from '@/hooks/useConnectivity';
import {
  ShieldAlert,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  Package,
  Layers,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'families' | 'distributions' | 'stock' | 'conflicts';
  setActiveTab: (tab: 'families' | 'distributions' | 'stock' | 'conflicts') => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
  connectivityStatus: ConnectivityStatus;
  latencyMs: number | null;
  isSimulatedOffline: boolean;
  toggleSimulateOffline: () => void;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  onTriggerSync,
  isSyncing = false,
  connectivityStatus,
  latencyMs,
  isSimulatedOffline,
  toggleSimulateOffline,
}: NavbarProps) {
  const [deviceId, setDeviceId] = useState<string>('DEV-INIT');

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const pendingOps = useLiveQuery(
    () => db.outbox.where('status').equals('PENDING').count(),
    [],
    0
  );

  const openConflicts = useLiveQuery(
    () => db.conflicts.where('status').equals('OPEN').count(),
    [],
    0
  );

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Camp Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shadow-inner ring-1 ring-sky-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white tracking-tight text-lg">
                  ReliefSync
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  PWA
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Cauvery Relief Camp #1</span>
                <span>•</span>
                <span className="font-mono text-slate-500">{deviceId}</span>
              </p>
            </div>
          </div>

          {/* Sync Status Badge & Network Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Simulation Toggle */}
            <button
              onClick={toggleSimulateOffline}
              title={isSimulatedOffline ? 'Resume Network Connection' : 'Simulate Offline Mode (Field Network Cut)'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isSimulatedOffline
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700'
              }`}
            >
              {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {isSimulatedOffline ? 'Offline Active' : 'Cut Signal'}
              </span>
            </button>

            {/* Network State Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border ${
                connectivityStatus === 'ONLINE'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : connectivityStatus === 'LIE_FI'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectivityStatus === 'ONLINE'
                    ? 'bg-emerald-400'
                    : connectivityStatus === 'LIE_FI'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="hidden md:inline font-mono text-[11px]">
                {connectivityStatus === 'ONLINE'
                  ? `Online (${latencyMs || 12}ms)`
                  : connectivityStatus === 'LIE_FI'
                  ? 'Lie-Fi (No Internet)'
                  : 'Offline'}
              </span>
            </div>

            {/* Conflict Warning */}
            {openConflicts > 0 && (
              <button
                onClick={() => setActiveTab('conflicts')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse hover:bg-rose-500/30 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{openConflicts} Conflict{openConflicts > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Outbox Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                pendingOps > 0
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${pendingOps > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span>
                {pendingOps > 0
                  ? `${pendingOps} Queued`
                  : 'Synced'}
              </span>
            </div>

            {/* Manual Sync Button */}
            {onTriggerSync && (
              <button
                onClick={onTriggerSync}
                disabled={isSyncing || connectivityStatus === 'OFFLINE'}
                title="Sync queued changes with server"
                className="p-2 rounded-lg bg-sky-600/90 text-white hover:bg-sky-500 transition-colors border border-sky-500/30 disabled:opacity-40 shadow-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-800/60 pt-1 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('families')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'families'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            Families
          </button>

          <button
            onClick={() => setActiveTab('distributions')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'distributions'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            Aid Distribution
          </button>

          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            Camp Stock
          </button>

          <button
            onClick={() => setActiveTab('conflicts')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap relative ${
              activeTab === 'conflicts'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Conflict Inbox
            {openConflicts > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                {openConflicts}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
