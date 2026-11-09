import React from 'react';
import { Glasses, Camera, Volume2, VolumeX, Pause, Flame, Zap, Trophy, MessageCircle, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { CameraViewMode } from '../game/engine';

interface RacingHUDProps {
  speedKmh: number;
  gear: string;
  boost: number;
  isBoosting: boolean;
  isDrifting: boolean;
  driftScore: number;
  lap: number;
  totalLaps: number;
  currentLapTime: number;
  bestLapTime: number | null;
  rank: number;
  totalRacers: number;
  cameraMode: CameraViewMode;
  onToggleCamera: () => void;
  onToggleVR: () => void;
  isInVR: boolean;
  isVRSupported: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSendEmote: (emote: string) => void;
  latestNotification: string | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds * 10) % 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
}

export const RacingHUD: React.FC<RacingHUDProps> = ({
  speedKmh,
  gear,
  boost,
  isBoosting,
  isDrifting,
  driftScore,
  lap,
  totalLaps,
  currentLapTime,
  bestLapTime,
  rank,
  totalRacers,
  cameraMode,
  onToggleCamera,
  onToggleVR,
  isInVR,
  isVRSupported: _isVRSupported,
  isMuted,
  onToggleMute,
  onPause,
  onSendEmote,
  latestNotification,
}) => {
  // Mobile virtual buttons dispatch keyboard events
  const sendKey = (code: string, isDown: boolean) => {
    window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { code }));
  };

  // High-Speed Motion Blur Intensity (> 100 km/h) + Nitro Boost
  const speedRatio = Math.max(0, (speedKmh - 100) / 100);
  const motionBlurOpacity = Math.min(0.85, (speedRatio * 0.55) + (isBoosting ? 0.35 : 0));

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-2.5 sm:p-4 md:p-6 overflow-hidden"
    >
      {/* High-Speed Motion Blur & Radial Speed Streaks Overlay */}
      {motionBlurOpacity > 0.05 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: motionBlurOpacity,
            background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0, 229, 255, 0.08) 70%, rgba(5, 8, 16, 0.55) 100%)',
          }}
        >
          <svg className="w-full h-full opacity-70" viewBox="0 0 1000 600" preserveAspectRatio="none">
            <defs>
              <linearGradient id="streakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="70%" stopColor="#00e5ff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {/* Speed streaks radiating from screen center */}
            {[
              [500, 300, 50, 40],
              [500, 300, 950, 50],
              [500, 300, 20, 280],
              [500, 300, 980, 320],
              [500, 300, 80, 550],
              [500, 300, 920, 560],
              [500, 300, 320, 20],
              [500, 300, 680, 20],
              [500, 300, 250, 580],
              [500, 300, 750, 580],
              [500, 300, 50, 160],
              [500, 300, 950, 180],
              [500, 300, 60, 420],
              [500, 300, 940, 440],
            ].map(([cx, cy, x2, y2], idx) => (
              <line
                key={idx}
                x1={cx + (x2 - cx) * 0.42}
                y1={cy + (y2 - cy) * 0.42}
                x2={x2}
                y2={y2}
                stroke="url(#streakGrad)"
                strokeWidth={idx % 2 === 0 ? '2.5' : '1.5'}
                strokeDasharray={isBoosting ? '20 10' : '40 15'}
              />
            ))}
          </svg>
        </div>
      )}

      {/* Top Bar: Lap Stats & Controls Cluster */}
      <div className="flex flex-wrap items-center justify-between w-full gap-2 relative z-10">
        {/* Top Right: Lap Counter & Position Rank */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Position Rank */}
          <div className="px-2.5 sm:px-3 py-1.5 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-amber-500/50 shadow-lg flex items-center gap-1.5 text-right">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <div>
              <div className="text-base sm:text-lg font-black text-amber-300 font-mono tabular-nums leading-none">
                {rank} <span className="text-[10px] text-slate-400 font-normal">/{totalRacers}</span>
              </div>
            </div>
          </div>

          {/* Lap Counter & Time */}
          <div className="px-2.5 sm:px-3 py-1.5 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-lg text-right">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-cyan-400 font-mono">الدورة</span>
              <span className="text-xs sm:text-sm font-extrabold text-white font-mono tabular-nums">
                {lap}/{totalLaps}
              </span>
              <span className="text-xs sm:text-sm font-black text-white font-mono tabular-nums mr-1.5">
                {formatTime(currentLapTime)}
              </span>
            </div>
            {bestLapTime !== null && (
              <div className="text-[9px] text-slate-400 font-mono tabular-nums hidden sm:block">
                أفضل دورة: {formatTime(bestLapTime)}
              </div>
            )}
          </div>
        </div>

        {/* Top Center: Notification Banner if active */}
        {latestNotification && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/95 border border-cyan-400/50 text-cyan-300 text-xs font-bold shadow-xl animate-bounce">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{latestNotification}</span>
          </div>
        )}

        {/* Top Left: Utility Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 pointer-events-auto mr-auto">
          {/* WebXR VR Toggle */}
          <button
            onClick={onToggleVR}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border transition cursor-pointer shadow-md text-xs font-semibold ${
              isInVR
                ? 'bg-purple-900/90 border-purple-400 text-purple-200'
                : 'bg-slate-900/80 border-purple-600/60 text-purple-300 hover:bg-purple-950/80'
            }`}
            aria-label="الواقع الافتراضي VR"
          >
            <Glasses className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">{isInVR ? 'خروج' : 'VR'}</span>
          </button>

          {/* Camera View Toggle */}
          <button
            onClick={onToggleCamera}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border transition cursor-pointer shadow-md text-xs font-semibold ${
              cameraMode === 'cockpit'
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
            aria-label="تبديل الكاميرا"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{cameraMode === 'cockpit' ? 'كابينة القيادة' : 'منظور خلفي'}</span>
          </button>

          {/* Sound Mute */}
          <button
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer shadow-md"
            aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Pause */}
          <button
            onClick={onPause}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer shadow-md"
            aria-label="إيقاف مؤقت"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle Center: Drift & Nitro Dynamic Badges */}
      <div className="flex flex-col items-center justify-center my-auto">
        {isDrifting && (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-amber-600/90 to-red-600/90 text-white font-black text-xs uppercase tracking-wider shadow-2xl animate-pulse">
            <Flame className="w-4 h-4 text-amber-200 fill-amber-200" />
            <span>دريفت! +{driftScore}</span>
          </div>
        )}

        {isBoosting && (
          <div className="mt-1 flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-black text-xs uppercase tracking-wider shadow-2xl">
            <Zap className="w-4 h-4 text-cyan-200 fill-cyan-200" />
            <span>نيترو خارق!</span>
          </div>
        )}
      </div>

      {/* Bottom Area: Controls, Emotes & Speedometer */}
      <div className="flex flex-col sm:flex-row items-end justify-between w-full gap-2">
        {/* Bottom Left: Touch Steering Controls & Quick Emotes */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {/* Quick Emotes Bar */}
          <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1 shadow-lg max-w-xs">
            <MessageCircle className="w-3.5 h-3.5 text-cyan-400 ml-0.5" />
            {['🏎️ سأسبقك!', '🔥 سرعة!', '💨 دريفت!', '👏 رائع!'].map((emote) => (
              <button
                key={emote}
                onClick={() => onSendEmote(emote)}
                className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[10px] sm:text-xs text-white transition active:scale-95 cursor-pointer"
              >
                {emote}
              </button>
            ))}
          </div>

          {/* On-Screen Mobile Touch Controls (Visible on mobile screens) */}
          <div className="flex sm:hidden items-center gap-2 pt-1">
            <button
              onPointerDown={() => sendKey('KeyA', true)}
              onPointerUp={() => sendKey('KeyA', false)}
              className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-cyan-600"
              aria-label="انعطاف لليسار"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <button
              onPointerDown={() => sendKey('KeyD', true)}
              onPointerUp={() => sendKey('KeyD', false)}
              className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700 text-white flex items-center justify-center active:bg-cyan-600"
              aria-label="انعطاف لليمين"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
            <button
              onPointerDown={() => sendKey('KeyW', true)}
              onPointerUp={() => sendKey('KeyW', false)}
              className="w-12 h-12 rounded-xl bg-cyan-600/90 border border-cyan-400 text-slate-950 flex items-center justify-center font-bold active:bg-cyan-400"
              aria-label="تسارع"
            >
              <ArrowUp className="w-6 h-6" />
            </button>
            <button
              onPointerDown={() => sendKey('KeyS', true)}
              onPointerUp={() => sendKey('KeyS', false)}
              className="w-12 h-12 rounded-xl bg-slate-800/90 border border-slate-700 text-red-400 flex items-center justify-center active:bg-red-600"
              aria-label="فرامل / رجوع"
            >
              <ArrowDown className="w-6 h-6" />
            </button>
            <button
              onPointerDown={() => sendKey('Space', true)}
              onPointerUp={() => sendKey('Space', false)}
              className="px-3 h-12 rounded-xl bg-purple-600/90 border border-purple-400 text-white text-xs font-bold active:bg-purple-400 flex items-center justify-center gap-1"
              aria-label="نيترو"
            >
              <Zap className="w-4 h-4" />
              <span>نيترو</span>
            </button>
          </div>
        </div>

        {/* Bottom Right: Speedometer & Nitro Meter */}
        <div className="flex flex-col items-end gap-1.5 mr-auto sm:mr-0">
          {/* Nitro Gauge */}
          <div className="w-36 sm:w-48 bg-slate-950/90 border border-slate-700/80 rounded-xl p-1.5 shadow-xl text-right">
            <div className="flex items-center justify-between text-[9px] font-mono text-cyan-400 mb-0.5">
              <span>خزان النيترو [Space]</span>
              <span className="font-bold tabular-nums">{Math.round(boost)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-l from-cyan-400 to-blue-500 rounded-full transition-all duration-75"
                style={{ width: `${boost}%` }}
              />
            </div>
          </div>

          {/* Hero Digital Speedometer */}
          <div className="px-4 py-2 sm:px-6 sm:py-3 rounded-2xl bg-slate-950/90 border border-cyan-500/40 shadow-2xl flex items-baseline gap-3 text-right">
            <div className="flex flex-col items-center justify-center pl-2 border-l border-slate-800">
              <span className="text-[9px] text-slate-400 font-mono uppercase">الترس</span>
              <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">{gear}</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight tabular-nums">
                  {speedKmh}
                </span>
                <span className="text-[10px] font-bold text-cyan-400 uppercase font-mono">كم/س</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
