/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, OpponentData, CameraViewMode } from './game/engine';
import { CarModelType } from './game/models';
import { CarState } from './game/physics';
import { TitleScreen } from './components/TitleScreen';
import { RacingHUD } from './components/RacingHUD';
import { MultiplayerModal } from './components/MultiplayerModal';
import { PauseModal, GameOverModal } from './components/StatusModals';
import { sound } from './game/audio';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // App & Game State
  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'gameover'>('title');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');
  const [isMuted, setIsMuted] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [isVRSupported, setIsVRSupported] = useState(false);

  // Player Customization
  const [playerName, setPlayerName] = useState(() => {
    return 'سائق_' + Math.floor(100 + Math.random() * 900);
  });
  const [carModel, setCarModel] = useState<CarModelType>('hypercar');
  const [carColor, setCarColor] = useState('#00e5ff');
  const [myPlayerId] = useState(() => 'driver_' + Math.random().toString(36).substr(2, 6));

  // Racing Telemetry (Throttled from 60Hz loop)
  const [speedKmh, setSpeedKmh] = useState(0);
  const [gear, setGear] = useState('N');
  const [boost, setBoost] = useState(100);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftScore, setDriftScore] = useState(0);
  const [lap, setLap] = useState(1);
  const totalLaps = 3;
  const [currentLapTime, setCurrentLapTime] = useState(0);
  const [bestLapTime, setBestLapTime] = useState<number | null>(null);
  const [totalRaceTime, setTotalRaceTime] = useState(0);
  const [rank, setRank] = useState(1);
  const [totalRacers, setTotalRacers] = useState(4);
  const [notification, setNotification] = useState<string | null>(null);

  // Multiplayer State
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('حلبة-المستقبل');
  const [isHost, setIsHost] = useState(false);
  const [opponents, setOpponents] = useState<OpponentData[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Show temporary banner notification
  const showBanner = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 2800);
  }, []);

  // Synchronize document body dataset state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Connect to WebSocket Server
  const connectWebSocket = useCallback((targetRoomId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // Join room
        socket.send(
          JSON.stringify({
            type: 'join_room',
            roomId: targetRoomId,
            playerId: myPlayerId,
            playerName,
            carModel,
            color: carColor,
            inVR: isInVR,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'room_joined') {
            setIsHost(data.isHost);
            if (data.chatMessages) {
              setChatMessages(data.chatMessages);
            }
          }

          if (data.type === 'sync_tick' && data.players) {
            setOpponents(data.players);
            if (engineRef.current) {
              engineRef.current.syncOpponents(data.players, myPlayerId);
            }
          }

          if (data.type === 'player_joined') {
            showBanner(`انضم السائق ${data.player?.name} إلى الحلبة!`);
          }

          if (data.type === 'race_countdown') {
            sound.playCountdown(data.count);
            showBanner(`استعد! الانطلاق خلال: ${data.count}`);
          }

          if (data.type === 'race_start') {
            sound.playCountdown(0);
            showBanner('انطلق! GO!');
            setGameState('playing');
            engineRef.current?.setGameState('playing');
          }

          if (data.type === 'new_chat' && data.message) {
            setChatMessages((prev) => [...prev.slice(-25), data.message]);
          }

          if (data.type === 'player_emote') {
            showBanner(`${data.sender}: ${data.emote}`);
          }
        } catch {
          // ignore parsing error
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };
    } catch {
      setIsConnected(false);
    }
  }, [carColor, carModel, isInVR, myPlayerId, playerName, showBanner]);

  // Send network updates from car engine to WebSocket
  const handleNetworkSendState = useCallback(
    (carState: Partial<CarState> & { inVR: boolean }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'update_state',
            ...carState,
          })
        );
      }
    },
    []
  );

  // Initialize Three.js Game Engine once on mount
  useEffect(() => {
    if (!mountRef.current) return;

    const engine = new GameEngine(mountRef.current, carModel, carColor, {
      onStateUpdate: (state, speed, playerRank, total) => {
        setSpeedKmh(speed);
        setBoost(state.boost);
        setIsBoosting(state.isBoosting);
        setIsDrifting(state.isDrifting);
        setDriftScore(state.driftScore);
        setLap(state.lap);
        setCurrentLapTime(state.currentLapTime);
        setBestLapTime(state.bestLapTime);
        setRank(playerRank);
        setTotalRacers(total);

        // Calculate gear
        if (state.speed < -0.5) setGear('R');
        else if (speed < 5) setGear('1');
        else if (speed < 40) setGear('2');
        else if (speed < 80) setGear('3');
        else if (speed < 125) setGear('4');
        else if (speed < 175) setGear('5');
        else setGear('6');
      },
      onLapCompleted: (completedLap, time) => {
        showBanner(`أكملت الدورة ${completedLap} في ${time.toFixed(1)} ثانية!`);
      },
      onRaceFinished: (finalRank, best, total) => {
        setRank(finalRank);
        setBestLapTime(best);
        setTotalRaceTime(total);
        setGameState('gameover');
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'race_finished',
              rank: finalRank,
              bestLap: best,
              totalTime: total,
            })
          );
        }
      },
      onNetworkSendState: handleNetworkSendState,
      onCheckpointPassed: () => {
        // checkpoint passed
      },
    });

    engineRef.current = engine;
    setIsVRSupported(engine.vrSystem.isVRSupported);

    // Initial check for ?autostart=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
      engine.setGameState('playing');
    }

    // Connect WebSocket
    connectWebSocket(roomId);

    return () => {
      engine.destroy();
      engineRef.current = null;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [carColor, carModel, connectWebSocket, handleNetworkSendState, roomId]);

  // Update car customization when chosen in Title Screen
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCarConfiguration(carModel, carColor);
    }
  }, [carModel, carColor]);

  // Keyboard shortcut listener for Start, Pause, Mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.key === 'Enter' || e.code === 'Space') {
          handleStartRace();
          e.preventDefault();
        }
      } else if (gameState === 'playing') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          handlePause();
        }
      } else if (gameState === 'paused') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          handleResume();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Handlers
  const handleStartRace = () => {
    setGameState('playing');
    engineRef.current?.setGameState('playing');
  };

  const handlePause = () => {
    setGameState('paused');
    engineRef.current?.setGameState('paused');
  };

  const handleResume = () => {
    setGameState('playing');
    engineRef.current?.setGameState('playing');
  };

  const handleRestart = () => {
    engineRef.current?.restartRace();
    setGameState('playing');
    engineRef.current?.setGameState('playing');
  };

  const handleTitleScreen = () => {
    setGameState('title');
    engineRef.current?.setGameState('title');
  };

  const handleToggleCamera = () => {
    if (engineRef.current) {
      engineRef.current.toggleCamera();
      setCameraMode(engineRef.current.getCameraMode());
    }
  };

  const handleToggleVR = async () => {
    if (!engineRef.current) return;
    try {
      if (engineRef.current.vrSystem.isInVR) {
        await engineRef.current.vrSystem.exitVRSession();
        setIsInVR(false);
      } else {
        await engineRef.current.vrSystem.requestVRSession();
        setIsInVR(true);
        showBanner('تم تفعيل وضع الواقع الافتراضي VR بنجاح!');
      }
    } catch (err) {
      // If WebXR hardware is not connected, simulate cockpit mode
      handleToggleCamera();
      showBanner('وضع كابينة القيادة (محاكاة VR)');
    }
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleSendChatMessage = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          text,
        })
      );
    }
  };

  const handleSendEmote = (emote: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'quick_emote',
          emote,
        })
      );
    }
    showBanner(`أرسلت: ${emote}`);
  };

  const handleStartMultiplayerRace = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'start_race',
        })
      );
    }
    setIsMultiplayerOpen(false);
    showBanner('جاري إطلاق شارة السباق لجميع السائقين...');
  };

  const handleJoinRoom = (newRoomId: string) => {
    setRoomId(newRoomId);
    connectWebSocket(newRoomId);
    showBanner(`تم الانتقال إلى الغرفة: ${newRoomId}`);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Isolated Three.js WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          carModel={carModel}
          setCarModel={setCarModel}
          carColor={carColor}
          setCarColor={setCarColor}
          onStartRace={handleStartRace}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          onEnterVR={handleToggleVR}
          isVRSupported={isVRSupported}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* In-Race HUD Overlay */}
      {gameState === 'playing' && (
        <RacingHUD
          speedKmh={speedKmh}
          gear={gear}
          boost={boost}
          isBoosting={isBoosting}
          isDrifting={isDrifting}
          driftScore={driftScore}
          lap={lap}
          totalLaps={totalLaps}
          currentLapTime={currentLapTime}
          bestLapTime={bestLapTime}
          rank={rank}
          totalRacers={totalRacers}
          cameraMode={cameraMode}
          onToggleCamera={handleToggleCamera}
          onToggleVR={handleToggleVR}
          isInVR={isInVR}
          isVRSupported={isVRSupported}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onSendEmote={handleSendEmote}
          latestNotification={notification}
        />
      )}

      {/* Pause Modal */}
      <PauseModal
        isOpen={gameState === 'paused'}
        onResume={handleResume}
        onRestart={handleRestart}
        onTitleScreen={handleTitleScreen}
      />

      {/* Game Over / Victory Modal */}
      <GameOverModal
        isOpen={gameState === 'gameover'}
        rank={rank}
        totalRacers={totalRacers}
        bestLap={bestLapTime}
        totalTime={totalRaceTime}
        driftScore={driftScore}
        onPlayAgain={handleRestart}
        onTitleScreen={handleTitleScreen}
      />

      {/* Multiplayer Lobby Modal */}
      <MultiplayerModal
        isOpen={isMultiplayerOpen}
        onClose={() => setIsMultiplayerOpen(false)}
        roomId={roomId}
        setRoomId={setRoomId}
        isConnected={isConnected}
        isHost={isHost}
        players={opponents}
        myPlayerId={myPlayerId}
        chatMessages={chatMessages}
        onSendMessage={handleSendChatMessage}
        onStartMultiplayerRace={handleStartMultiplayerRace}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
}
