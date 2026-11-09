import React, { useState } from 'react';
import { Users, X, Send, Play, Glasses, ShieldCheck, MessageSquare } from 'lucide-react';
import { OpponentData } from '../game/engine';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  setRoomId: (id: string) => void;
  isConnected: boolean;
  isHost: boolean;
  players: OpponentData[];
  myPlayerId: string;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onStartMultiplayerRace: () => void;
  onJoinRoom: (newRoomId: string) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  roomId,
  setRoomId,
  isConnected,
  isHost,
  players,
  myPlayerId,
  chatMessages,
  onSendMessage,
  onStartMultiplayerRace,
  onJoinRoom,
}) => {
  const [inputText, setInputText] = useState('');
  const [customRoomInput, setCustomRoomInput] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleJoinCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoomInput.trim()) return;
    onJoinRoom(customRoomInput.trim());
    setCustomRoomInput('');
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-none pointer-events-auto select-none"
    >
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>ردهة السباق الجماعي أونلاين</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {isConnected ? 'متصل بالخادم' : 'غير متصل'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">الغرفة الحالية: <span className="font-mono text-cyan-300 font-bold">{roomId}</span></p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Switcher */}
        <div className="py-3 flex flex-wrap items-center gap-2 border-b border-slate-800">
          <span className="text-xs text-slate-400 ml-2">غرف سريعة:</span>
          {['حلبة-المستقبل', 'سايبر-1', 'سرعة-النيون'].map((r) => (
            <button
              key={r}
              onClick={() => onJoinRoom(r)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                roomId === r ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {r}
            </button>
          ))}

          <form onSubmit={handleJoinCustom} className="flex items-center gap-1.5 mr-auto">
            <input
              type="text"
              value={customRoomInput}
              onChange={(e) => setCustomRoomInput(e.target.value)}
              placeholder="اسم غرفة مخصصة..."
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-36"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition"
            >
              دخول
            </button>
          </form>
        </div>

        {/* Modal Body: 2 Columns (Drivers List & Live Chat) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 flex-1 overflow-hidden min-h-[260px]">
          {/* Column 1: Connected Drivers */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-slate-300">السائقون المتصلون ({players.length})</span>
              <span className="text-[10px] text-cyan-400 font-mono">حلبة 3D جاهزة</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {players.map((p) => {
                const isMe = p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isMe ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {isMe && <span className="text-[10px] text-cyan-400 font-normal">(أنت)</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">طراز: {p.carModel}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.inVR && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 text-[10px]">
                          <Glasses className="w-3 h-3" />
                          <span>VR</span>
                        </span>
                      )}
                      {p.id === players[0]?.id && (
                        <span title="مضيف الغرفة">
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Live Room Chat */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80 text-xs font-bold text-slate-300">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>محادثة السائقين المباشرة</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
              {chatMessages.map((m) => (
                <div key={m.id} className="text-xs bg-slate-900/70 rounded-xl p-2 border border-slate-800/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5 font-mono">
                    <span className="font-bold text-cyan-400">{m.sender}</span>
                    <span>{m.time}</span>
                  </div>
                  <div className="text-slate-200">{m.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب رسالة للسائقين..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {isHost ? 'أنت مضيف الغرفة، يمكنك إطلاق شارة بداية السباق لجميع السائقين!' : 'في انتظار إشارة انطلاق السباق من المضيف...'}
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex-1 sm:flex-initial"
            >
              العودة
            </button>

            <button
              onClick={onStartMultiplayerRace}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20 flex-1 sm:flex-initial"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>ابدأ السباق الجماعي للجميع</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
