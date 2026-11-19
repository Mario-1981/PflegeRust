import React, { useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'menuItem';
  onAfterTrigger?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onAfterTrigger,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Suppress button when already running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  // In compact header, only show when directly installable or on iOS/Android
  if (variant === 'header' && !isInstallable && !isIOS && !isAndroid) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
      onAfterTrigger?.();
      return;
    }
    setShowGuideModal(true);
  };

  const renderButton = () => {
    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={handleTrigger}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2.5 min-h-[40px] rounded-md text-xs font-semibold text-white bg-teal-700 hover:bg-teal-600 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Als App installieren</span>
          </span>
          <Download className="w-3.5 h-3.5 shrink-0 opacity-85" />
        </button>
      );
    }

    if (variant === 'menuItem') {
      return (
        <button
          type="button"
          role="menuitem"
          onClick={handleTrigger}
          className="w-full flex items-center justify-between gap-2 px-2.5 py-2.5 min-h-[40px] rounded text-left text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-teal-700" />
            <span>Als App installieren (iOS / Android)</span>
          </span>
          <Download className="w-3.5 h-3.5 text-slate-400" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleTrigger}
        title="PflegeRust als Web-App auf Smartphone, Tablet oder Desktop installieren"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[38px] sm:min-h-[34px] text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-4 h-4 text-teal-700 shrink-0" />
        <span className="hidden sm:inline">App installieren</span>
      </button>
    );
  };

  return (
    <>
      {renderButton()}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-0 sm:p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden safe-bottom"
          >
            {/* Mobile drag affordance */}
            <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5" />

            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  PR
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    PflegeRust als Web-App installieren
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Vollbild-Modus für iPhone, iPad, Android &amp; Tablet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {isIOS ? (
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900">
                    Installation auf iPhone &amp; iPad (Safari):
                  </div>
                  <ol className="space-y-2.5">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Tippen Sie in der Safari-Symbolleiste auf{' '}
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                          <Share className="w-3.5 h-3.5 text-teal-700" />
                          Teilen
                        </span>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Scrollen Sie nach unten und wählen Sie{' '}
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                          <PlusSquare className="w-3.5 h-3.5 text-teal-700" />
                          Zum Home-Bildschirm
                        </span>
                        .
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        Tippen Sie oben rechts auf <strong>Hinzufügen</strong>. PflegeRust startet danach direkt im Vollbild-App-Modus.
                      </span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900">
                    Installation auf Android-Smartphone, Tablet oder Desktop:
                  </div>
                  <ol className="space-y-2.5">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Öffnen Sie das Browser-Menü (<strong>⋮</strong> in Chrome/Edge bzw. <strong>Teilen</strong> in iOS Safari).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Wählen Sie <strong>App installieren</strong> oder{' '}
                        <strong>Zum Startbildschirm hinzufügen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>
                        Bestätigen Sie die Installation – PflegeRust erscheint als eigenständige App inkl. Offline-Cache.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-[11px] text-teal-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  Unterstützt Hoch- und Querformat (iPhone, iPad, Android-Handy &amp; Tablet), Passkeys/Face ID/Touch ID sowie Offline-Zwischenspeicher.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowGuideModal(false);
                  onAfterTrigger?.();
                }}
                className="w-full min-h-[44px] rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
