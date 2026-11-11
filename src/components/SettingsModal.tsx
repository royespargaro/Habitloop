import React from 'react';
import { X, LogOut, User } from 'lucide-react';
export const SettingsModal = ({ onClose, user, onSignOut }: { onClose: () => void, user: any, onSignOut: () => void }) => {
  const handleSignOut = async () => {
    await onSignOut();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 border border-[#222226] bg-[#08080a] rounded-sm">
            <User className="text-[#d4ff3a]" />
            <div>
              <p className="text-sm font-semibold text-[#f4f4f5]">Account</p>
              <p className="text-xs text-[#71717a]">{user ? user.email : 'Not signed in'}</p>
            </div>
          </div>
          
          {user && (
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-2 border border-[#222226] bg-[#0d0d10] hover:bg-[#1a1a1f] text-[#ffaaa0] rounded-sm text-sm"
            >
              <LogOut size={16} /> Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
