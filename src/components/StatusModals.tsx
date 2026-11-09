import React from 'react';
import { Play, RotateCcw, Home, Trophy, Clock, Flame, Flag } from 'lucide-react';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onTitleScreen: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onTitleScreen,
}) => {
  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 pointer-events-auto select-none"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-center">
        <h2 className="text-2xl font-black text-white mb-2">السباق متوقف مؤقتاً</h2>
        <p className="text-xs text-slate-400 mb-6">اضغط متابعة لاستكمال السباق أو أعد المحاولة</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-500/20"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>متابعة السباق (P / Esc)</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition border border-slate-700"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>إعادة السباق من البداية</span>
          </button>

          <button
            onClick={onTitleScreen}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-sm transition"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>الشاشة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  isOpen: boolean;
  rank: number;
  totalRacers: number;
  bestLap: number | null;
  totalTime: number;
  driftScore: number;
  onPlayAgain: () => void;
  onTitleScreen: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds * 10) % 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  rank,
  totalRacers,
  bestLap,
  totalTime,
  driftScore,
  onPlayAgain,
  onTitleScreen,
}) => {
  if (!isOpen) return null;

  const isPodium = rank <= 3;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto select-none"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Outcome Trophy */}
        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-400/50 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Trophy className="w-8 h-8 text-amber-300" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
          {isPodium ? 'نهاية السباق! منصة التتويج' : 'اكتمل السباق بنجاح!'}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {rank === 1 ? 'تهانينا! لقد حققت المركز الأول في البطولة!' : `أنهيت السباق بالمركز ${rank} بين ${totalRacers} متسابقين`}
        </p>

        {/* 3 Tabular Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center">
            <Flag className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block font-mono">المركز</span>
            <div className="text-lg font-black text-amber-300 font-mono tabular-nums">
              #{rank} <span className="text-xs text-slate-500 font-normal">/{totalRacers}</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center">
            <Clock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block font-mono">أفضل دورة</span>
            <div className="text-base font-black text-white font-mono tabular-nums mt-0.5">
              {bestLap ? formatTime(bestLap) : '--:--'}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center">
            <Flame className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] text-slate-400 block font-mono">نقاط الدريفت</span>
            <div className="text-base font-black text-amber-300 font-mono tabular-nums mt-0.5">
              {driftScore}
            </div>
          </div>
        </div>

        {/* Total Race Time */}
        <div className="text-xs text-slate-400 font-mono mb-6">
          إجمالي زمن السباق: <span className="text-white font-bold">{formatTime(totalTime)}</span>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm transition shadow-lg shadow-cyan-500/20"
          >
            <RotateCcw className="w-4 h-4 fill-current" />
            <span>تسابق مجدداً</span>
          </button>

          <button
            onClick={onTitleScreen}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition border border-slate-700"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};
