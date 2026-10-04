'use client';

import React, { useState, useEffect } from 'react';
import { Family, Vulnerability } from '@/lib/types';
import { updateFamily, deleteFamily } from '@/lib/familyService';
import { X, Edit3, Trash2, Check, AlertCircle } from 'lucide-react';

interface FamilyEditModalProps {
  family: Family | null;
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_VULNERABILITIES: { id: Vulnerability; label: string; icon: string }[] = [
  { id: 'ELDERLY', label: 'Elderly (>60)', icon: '👵' },
  { id: 'PREGNANT', label: 'Pregnant Mother', icon: '🤰' },
  { id: 'INFANT', label: 'Infant (<2yr)', icon: '👶' },
  { id: 'DISABLED', label: 'Person with Disability', icon: '♿' },
  { id: 'MEDICAL_NEED', label: 'Critical Medical Need', icon: '💊' },
];

export default function FamilyEditModal({
  family,
  isOpen,
  onClose,
}: FamilyEditModalProps) {
  const [headName, setHeadName] = useState('');
  const [phone, setPhone] = useState('');
  const [familySize, setFamilySize] = useState<number>(1);
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<Vulnerability[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (family) {
      setHeadName(family.headName || '');
      setPhone(family.phone || '');
      setFamilySize(family.familySize || 1);
      setSelectedVulnerabilities(family.vulnerabilities || []);
      setConfirmDelete(false);
    }
  }, [family]);

  if (!isOpen || !family) return null;

  const toggleVulnerability = (v: Vulnerability) => {
    setSelectedVulnerabilities((prev) =>
      prev.includes(v) ? prev.filter((item) => item !== v) : [...prev, v]
    );
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headName.trim()) return;

    try {
      setIsSubmitting(true);
      await updateFamily(family.id, {
        headName,
        phone,
        familySize,
        vulnerabilities: selectedVulnerabilities,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update family offline:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      await deleteFamily(family.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete family offline:', err);
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
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit Family Record</h2>
              <p className="text-xs text-slate-400">ID: #{family.id.substring(0, 8)}</p>
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
        <form onSubmit={handleUpdate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Head of Household Name *
            </label>
            <input
              type="text"
              required
              value={headName}
              onChange={(e) => setHeadName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Total Family Members
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={familySize}
                onChange={(e) => setFamilySize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Vulnerability Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Vulnerabilities & Priority Needs
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VULNERABILITIES.map((vuln) => {
                const active = selectedVulnerabilities.includes(vuln.id);
                return (
                  <button
                    type="button"
                    key={vuln.id}
                    onClick={() => toggleVulnerability(vuln.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-300'
                    }`}
                  >
                    <span>{vuln.icon}</span>
                    <span>{vuln.label}</span>
                    {active && <Check className="w-3.5 h-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Danger Zone: Delete */}
          <div className="pt-3 border-t border-slate-800">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Soft-delete family from camp registry
              </button>
            ) : (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Mark as deleted in outbox?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting || !headName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-all shadow-lg shadow-amber-600/30 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes (Offline)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
