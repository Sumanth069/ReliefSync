'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedInitialCampData } from '@/lib/db';
import { syncNow } from '@/lib/syncEngine';
import { useConnectivity } from '@/hooks/useConnectivity';
import Navbar from '@/components/Navbar';
import FamilyList from '@/components/FamilyList';
import DistributionList from '@/components/DistributionList';
import StockView from '@/components/StockView';
import ConflictInbox from '@/components/ConflictInbox';
import DiagnosticsModal from '@/components/DiagnosticsModal';
import { Users, Heart, Package, CloudOff, WifiOff, RefreshCw, Terminal, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'families' | 'distributions' | 'stock' | 'conflicts'>('families');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const {
    status: connectivityStatus,
    latencyMs,
    isSimulatedOffline,
    toggleSimulateOffline,
  } = useConnectivity();

  // Initialize sample camp data on initial launch
  useEffect(() => {
    seedInitialCampData();
  }, []);

  const handleSyncTrigger = useCallback(async () => {
    if (connectivityStatus === 'OFFLINE') return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const res = await syncNow();
      if (res.conflicts > 0) {
        setSyncFeedback(`⚠️ Synced: ${res.pushed} uploaded, ${res.conflicts} conflict detected!`);
        setActiveTab('conflicts');
      } else if (res.pushed > 0 || res.pulled > 0) {
        setSyncFeedback(`✓ Sync Complete: ${res.pushed} uploaded, ${res.pulled} changes pulled.`);
      } else {
        setSyncFeedback('✓ Everything up to date.');
      }
    } catch (err: any) {
      setSyncFeedback(`Sync failed: ${err.message || 'Network error'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  }, [connectivityStatus]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (connectivityStatus === 'ONLINE') {
      handleSyncTrigger();
    }
  }, [connectivityStatus, handleSyncTrigger]);

  // Aggregate stats from local Dexie database
  const families = useLiveQuery(() => db.families.filter((f) => !f.isDeleted).toArray(), [], []);
  const distributions = useLiveQuery(() => db.distributions.toArray(), [], []);
  const pendingCount = useLiveQuery(() => db.outbox.where('status').equals('PENDING').count(), [], 0);

  const totalPeople = families?.reduce((acc, f) => acc + (f.familySize || 0), 0) || 0;
  const totalAidGiven = distributions?.reduce((acc, d) => acc + (d.qty || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTriggerSync={handleSyncTrigger}
        isSyncing={isSyncing}
        connectivityStatus={connectivityStatus}
        latencyMs={latencyMs}
        isSimulatedOffline={isSimulatedOffline}
        toggleSimulateOffline={toggleSimulateOffline}
      />

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="bg-sky-950/80 border-b border-sky-800/80 px-4 py-2 text-center text-xs font-semibold text-sky-200 animate-in fade-in flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Simulated Offline Notice Banner */}
      {isSimulatedOffline && (
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2 text-center text-xs font-bold text-rose-200 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4 text-rose-400" />
          <span>
            SIMULATION MODE ACTIVE: Device network signal is cut. All registrations and aid handouts are saving offline.
          </span>
          <button
            onClick={toggleSimulateOffline}
            className="underline ml-2 hover:text-white"
          >
            Restore Connection & Sync
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Quick Camp Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{families?.length || 0}</p>
              <p className="text-xs text-slate-400 font-medium">Families Registered</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalPeople}</p>
              <p className="text-xs text-slate-400 font-medium">People Sheltered</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalAidGiven}</p>
              <p className="text-xs text-slate-400 font-medium">Aid Items Distributed</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                pendingCount > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-700/40 text-slate-400'
              }`}
            >
              <CloudOff className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{pendingCount}</p>
              <p className="text-xs text-slate-400 font-medium">Queued in Outbox</p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'families' && <FamilyList />}
        {activeTab === 'distributions' && <DistributionList />}
        {activeTab === 'stock' && <StockView />}
        {activeTab === 'conflicts' && <ConflictInbox />}
      </main>

      {/* Field Evaluator & Demo Guide Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/70 p-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
              PS ID: ALG-WEB-02
            </span>
            <span className="font-semibold text-slate-300">Offline-First Flood Relief PWA</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700 font-medium"
            >
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span>Diagnostics & Outbox Inspector</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
}
