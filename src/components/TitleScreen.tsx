import React from 'react';
import { CarModelType } from '../game/models';
import { Play, Users, Glasses, Volume2, VolumeX, Sparkles, Trophy } from 'lucide-react';

interface TitleScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  carModel: CarModelType;
  setCarModel: (model: CarModelType) => void;
  carColor: string;
  setCarColor: (color: string) => void;
  onStartRace: () => void;
  onOpenMultiplayer: () => void;
  onEnterVR: () => void;
  isVRSupported: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

const CAR_OPTIONS: { id: CarModelType; nameAr: string; nameEn: string; desc: string }[] = [
  { id: 'hypercar', nameAr: 'شبح السايبر', nameEn: 'Cyber Phantom', desc: 'سرعة قصوى خارقة وديناميكية هوائية فائقة' },
  { id: 'formula', nameAr: 'قمة الفورمولا', nameEn: 'Apex Formula', desc: 'تسارع صاروخي وتحكم استثنائي بالمنعطفات' },
  { id: 'buggy', nameAr: 'كاسر الصحراء', nameEn: 'Dune Raider', desc: 'هيكل متين وثبات فائق على جميع التضاريس' },
  { id: 'muscle', nameAr: 'الصاعق النيون', nameEn: 'Neon Muscle', desc: 'قوة عضلية هائلة وعزم دوران جبار في الدريفت' },
];

const COLOR_PALETTE = [
  { hex: '#00e5ff', name: 'أزرق نيون' },
  { hex: '#ff0055', name: 'وردي سايبر' },
  { hex: '#ffaa00', name: 'برتقالي شمسي' },
  { hex: '#00ff66', name: 'أخضر ليزري' },
  { hex: '#9d00ff', name: 'بنفسجي كهربائي' },
  { hex: '#ffffff', name: 'أبيض لؤلؤي' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  playerName,
  setPlayerName,
  carModel,
  setCarModel,
  carColor,
  setCarColor,
  onStartRace,
  onOpenMultiplayer,
  onEnterVR,
  isVRSupported,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-auto p-6 md:p-10 select-none overflow-y-auto"
      style={{
        background: 'radial-gradient(ellipse at 50% 15%, rgba(0, 229, 255, 0.12) 0%, rgba(8, 11, 18, 0.75) 60%, rgba(8, 11, 18, 0.92) 100%)',
      }}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase">WEBXR VR RACING</span>
            <div className="text-sm font-semibold text-slate-300">موسم بطولات الواقع الافتراضي</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-cyan-400 transition"
            aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* Enter VR directly from title */}
          <button
            onClick={onEnterVR}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-900/60 border border-purple-500/50 text-purple-200 hover:bg-purple-800/80 transition text-sm font-medium shadow-md shadow-purple-900/30"
          >
            <Glasses className="w-4 h-4 text-purple-400" />
            <span>{isVRSupported ? 'تشغيل الواقع الافتراضي (VR)' : 'محاكاة الواقع الافتراضي'}</span>
          </button>
        </div>
      </div>

      {/* Hero Title Lockup */}
      <div className="w-full max-w-4xl mx-auto my-auto text-center flex flex-col items-center pt-4 pb-4">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="mb-2 relative">
          <svg className="w-64 md:w-96 h-16 md:h-24 mx-auto" viewBox="0 0 380 90" fill="none">
            <defs>
              <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00e5ff" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ff0055" />
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Speed Slash lines */}
            <path d="M20 75 L360 75" stroke="#00e5ff" strokeWidth="2" strokeDasharray="8 6" opacity="0.6" />
            <path d="M60 82 L320 82" stroke="#ff0055" strokeWidth="3" opacity="0.8" />
            {/* Main Title Text */}
            <text
              x="190"
              y="52"
              textAnchor="middle"
              fill="url(#cyberGrad)"
              filter="url(#neonGlow)"
              fontSize="34"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              letterSpacing="2"
            >
              VR CYBER RACERS
            </text>
          </svg>
        </div>

        <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md mb-2">
          سباق السيارات الافتراضي
        </h1>
        <p className="text-sm md:text-base text-slate-300 max-w-lg mb-6 leading-relaxed">
          انطلق في حلبات المستقبل ثلاثية الأبعاد بتجربة الواقع الافتراضي الكاملة، ونافس السائقين عبر الإنترنت بأقصى سرعة!
        </p>

        {/* Customization Card */}
        <div className="w-full max-w-xl bg-slate-900/85 border border-slate-700/70 rounded-2xl p-5 shadow-2xl mb-6 backdrop-blur-none text-right">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Driver Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">اسم السائق</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                placeholder="أدخل اسمك"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-sm font-medium"
              />
            </div>

            {/* Color Swatches */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">لون الطلاء النيون</label>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setCarColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full transition transform hover:scale-110 ${
                      carColor === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg' : 'opacity-70'
                    }`}
                    title={c.name}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Car Model Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">اختر طراز السيارة</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CAR_OPTIONS.map((car) => (
                <button
                  key={car.id}
                  onClick={() => setCarModel(car.id)}
                  className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between ${
                    carModel === car.id
                      ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold">{car.nameAr}</span>
                  <span className="text-[10px] text-cyan-400/80 font-mono">{car.nameEn}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center">
          <button
            data-start="true"
            onClick={onStartRace}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-base transition transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-cyan-500/30 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>انطلق في السباق (Enter)</span>
          </button>

          <button
            onClick={onOpenMultiplayer}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600/80 text-white font-semibold text-base transition shadow-md cursor-pointer"
          >
            <Users className="w-5 h-5 text-cyan-400" />
            <span>اللعب الجماعي أونلاين</span>
          </button>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="w-full text-center pt-2">
        <p className="text-xs md:text-sm text-slate-400 font-mono tracking-wide">
          WASD / الأسهم للقيادة · Space نيترو · C الكاميرا · Shift دريفت · M كتم الصوت · Enter للبدء
        </p>
      </div>
    </div>
  );
};
