import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';
import { AppBenutzer } from '../types/pflege';
import {
  verifyPassword,
  validatePasswordPolicy,
  createPasswordRecord,
} from '../utils/authCrypto';

interface ChangePasswordModalProps {
  isOpen: boolean;
  currentUser: AppBenutzer | null;
  onClose: () => void;
  onSavePassword: (userId: string, salt: string, hash: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSavePassword,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !currentUser) return null;

  const policy = validatePasswordPolicy(newPassword);

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPassword) {
      setErrorMsg('Bitte geben Sie Ihr aktuelles Passwort zur Bestätigung ein.');
      return;
    }

    setIsSaving(true);
    try {
      const validCurrent = await verifyPassword(
        currentPassword,
        currentUser.passwortSalt,
        currentUser.passwortHash
      );
      if (!validCurrent) {
        setErrorMsg('Das aktuelle Passwort ist nicht korrekt.');
        return;
      }

      if (!policy.valid) {
        setErrorMsg('Das neue Passwort erfüllt noch nicht die Passwortrichtlinie.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMsg('Die neuen Passwörter stimmen nicht überein.');
        return;
      }

      if (newPassword === currentPassword) {
        setErrorMsg('Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.');
        return;
      }

      const { salt, hash } = await createPasswordRecord(newPassword);
      onSavePassword(currentUser.id, salt, hash);
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-md w-full overflow-hidden text-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-700" />
            <h3 className="font-bold text-slate-900 text-sm">Eigenes Passwort ändern</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Aktuelles Passwort *
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => setShowPasswords((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Neues Passwort *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Neues Passwort wiederholen *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1 text-[11px]">
            {[
              { ok: policy.checks.minLength, label: 'Mindestens 8 Zeichen' },
              { ok: policy.checks.hasUpper, label: 'Mindestens ein Großbuchstabe' },
              { ok: policy.checks.hasLower, label: 'Mindestens ein Kleinbuchstabe' },
              { ok: policy.checks.hasDigit, label: 'Mindestens eine Ziffer' },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-1.5 ${
                  item.ok ? 'text-emerald-700 font-medium' : 'text-slate-500'
                }`}
              >
                {item.ok ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving || !policy.valid}
              className="px-4 py-1.5 font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-md cursor-pointer"
            >
              {isSaving ? 'Speichere...' : 'Passwort aktualisieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
