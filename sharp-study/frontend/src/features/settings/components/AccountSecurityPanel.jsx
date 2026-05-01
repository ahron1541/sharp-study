import React from 'react';
import { Shield, Key, Trash2, Mail, ExternalLink, ChevronRight } from 'lucide-react';

export default function AccountSecurityPanel() {
  return (
    <div className="space-y-12">
      <header>
        <h2 className="text-2xl font-bold text-text mb-2">Account & Safety</h2>
        <p className="text-text-muted font-medium">Protect your data and manage your authentication methods.</p>
      </header>

      <div className="space-y-4">
        <SecurityOption 
          icon={<Key className="text-blue-500" />}
          label="Change Password"
          sub="Ensure your account is protected with a strong password."
          action="Update"
        />
        <SecurityOption 
          icon={<Mail className="text-emerald-500" />}
          label="Email Verification"
          sub="Verified: ahron***@gmail.com"
          action="Change"
        />
        <SecurityOption 
          icon={<Shield className="text-orange-500" />}
          label="Two-Factor Authentication"
          sub="Add an extra layer of security (Coming Soon)."
          disabled
        />
      </div>

      <div className="pt-10 border-t border-border">
         <h3 className="text-lg font-bold text-red-500 mb-6">Danger Area</h3>
         <button className="flex items-center justify-between w-full p-6 rounded-3xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all group">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-red-500/20 rounded-2xl">
                  <Trash2 className="text-red-600" size={20} />
               </div>
               <div className="text-left">
                  <p className="font-bold text-red-600">Delete My Account</p>
                  <p className="text-sm text-red-500/70 font-medium">This will permanently remove all your documents and study data.</p>
               </div>
            </div>
            <ChevronRight className="text-red-400 group-hover:translate-x-1 transition-transform" />
         </button>
      </div>
    </div>
  );
}

function SecurityOption({ icon, label, sub, action, disabled = false }) {
  return (
    <div className={`p-6 rounded-[2rem] border border-border bg-surface-2 flex items-center justify-between gap-4 transition-all ${disabled ? 'opacity-50' : 'hover:border-accent/40'}`}>
      <div className="flex items-center gap-4">
        <div className="p-4 bg-surface rounded-2xl shadow-sm">
          {icon}
        </div>
        <div>
          <p className="font-bold text-text">{label}</p>
          <p className="text-sm text-text-muted font-medium">{sub}</p>
        </div>
      </div>
      {action && (
        <button 
          disabled={disabled}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm border transition-all ${
            disabled 
              ? 'bg-transparent text-text-muted cursor-not-allowed border-border' 
              : 'bg-surface text-text border-border hover:border-accent hover:text-accent shadow-sm'
          }`}
        >
          {action}
        </button>
      )}
    </div>
  );
}
