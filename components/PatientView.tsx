
import React, { useEffect, useState, useRef } from 'react';
import { Mic, Activity, Heart, Play, Clock } from 'lucide-react';
import { ConnectionState, AppMode, TestType } from '../types';

interface PatientViewProps {
  connectionState: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  volumeLevel: number;
  appMode: AppMode;
  testType: TestType;
  onStartTest: () => void;
  onTestComplete: () => void;
}

export const PatientView: React.FC<PatientViewProps> = ({ 
  connectionState, 
  onConnect, 
  onDisconnect,
  volumeLevel,
  appMode,
  testType,
  onStartTest,
  onTestComplete
}) => {
  const [active, setActive] = useState(false);
  
  // Determine duration based on test type (15s for Semantic, 60s for others)
  const duration = testType === 'SEMANTIC' ? 15 : 60;
  
  const [timeLeft, setTimeLeft] = useState(duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (connectionState === 'connected') setActive(true);
    else setActive(false);
  }, [connectionState]);

  // Timer Logic for Test Active Mode
  useEffect(() => {
    if (appMode === AppMode.TEST_ACTIVE) {
        setTimeLeft(duration);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    if(timerRef.current) clearInterval(timerRef.current);
                    onTestComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(duration);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [appMode, onTestComplete, duration]);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  // Render "Test Setup" Overlay
  if (appMode === AppMode.TEST_SETUP) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-amber-50/50 rounded-3xl p-6 shadow-xl border border-amber-100 relative overflow-hidden">
            <div className="text-center mb-8 z-10">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-bold tracking-wide uppercase mb-4 inline-block">
                    Activity Time
                </span>
                <h2 className="text-3xl font-bold text-slate-800 mb-4">Word Game</h2>
                <p className="text-xl text-slate-600 max-w-md mx-auto">
                    {testType === 'SEMANTIC' 
                        ? `I want you to name as many animals as you can in ${duration} seconds.` 
                        : "I want you to name as many words starting with 'F' as you can in one minute."}
                </p>
            </div>

            {/* Microphone is technically active for questions, represented by small indicator */}
            <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm z-10">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-slate-500">Mic On</span>
            </div>

            <div className="relative z-10">
                <button
                    onClick={onStartTest}
                    className="group relative flex items-center justify-center w-40 h-40 rounded-full bg-red-500 shadow-xl shadow-red-200 hover:bg-red-600 hover:scale-105 transition-all duration-300"
                >
                    <Play className="w-16 h-16 text-white ml-2" fill="currentColor" />
                    <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping" />
                </button>
                <p className="mt-6 text-center text-slate-500 font-medium">Tap to Start</p>
            </div>
        </div>
      );
  }

  // Render "Test Active" Mode
  if (appMode === AppMode.TEST_ACTIVE) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] bg-red-50/30 rounded-3xl p-6 shadow-xl border border-red-100 relative">
             <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-slate-800 mb-2">Go!</h2>
                <p className="text-xl text-slate-600">Keep naming them...</p>
             </div>

             <div className="relative flex items-center justify-center w-48 h-48 md:w-64 md:h-64">
                 {/* Circular Progress Timer Effect */}
                 <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 256 256">
                     <circle cx="128" cy="128" r="110" stroke="#FECACA" strokeWidth="12" fill="none" />
                     <circle 
                        cx="128" 
                        cy="128" 
                        r="110" 
                        stroke="#EF4444" 
                        strokeWidth="12" 
                        fill="none" 
                        strokeDasharray={2 * Math.PI * 110}
                        strokeDashoffset={2 * Math.PI * 110 * (1 - timeLeft/duration)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear"
                     />
                 </svg>
                 <div className="absolute flex flex-col items-center">
                     <span className="text-5xl md:text-6xl font-bold text-slate-800 tabular-nums">{timeLeft}</span>
                     <span className="text-xs md:text-sm text-slate-500 uppercase font-bold tracking-wider">Seconds</span>
                 </div>
             </div>

             <div className="mt-8 flex items-center gap-2 text-slate-500 animate-pulse">
                 <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                 Recording...
             </div>

             <button 
                onClick={onTestComplete}
                className="mt-8 px-6 py-3 bg-white border-2 border-red-100 text-red-600 font-semibold rounded-full shadow-sm hover:bg-red-50 transition-colors flex items-center gap-2"
             >
                <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                Stop Test Early
             </button>
        </div>
      );
  }

  // Render "Conversation" Mode (Default)
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] bg-blue-50/50 rounded-3xl p-6 shadow-xl border border-blue-100">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-slate-800 mb-4 tracking-tight">Memory Lane Companion</h2>
        <p className="text-xl text-slate-600">I am here to listen and chat with you.</p>
      </div>

      <div className="relative mb-16">
        {isConnected && (
            <>
                <div className="pulse-ring" style={{ animationDuration: '3s' }}></div>
                <div className="pulse-ring" style={{ animationDuration: '4s', animationDelay: '0.5s' }}></div>
            </>
        )}
        
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          className={`relative z-10 rounded-full p-12 transition-all duration-500 transform hover:scale-105 focus:outline-none shadow-2xl ${
            isConnected 
              ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
          }`}
        >
          {isConnecting ? (
             <Activity className="w-24 h-24 text-white animate-spin" />
          ) : isConnected ? (
             <div className="relative">
                <Mic className="w-24 h-24 text-white" />
                {/* Simulated volume indicator inside */}
                <div 
                    className="absolute inset-0 bg-white/20 rounded-full transition-all duration-75"
                    style={{ transform: `scale(${1 + volumeLevel * 4})` }}
                />
             </div>
          ) : (
            <div className="flex flex-col items-center">
                <Heart className="w-24 h-24 text-white mb-2" />
                <span className="text-white font-semibold text-lg">Tap to Start</span>
            </div>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-2xl font-medium text-slate-700 h-8">
            {isConnecting ? "Connecting..." : isConnected ? "Listening..." : "Ready to chat"}
        </p>
        <p className="text-slate-500 mt-2">
            {isConnected ? "Speak freely, I'm listening." : "Tap the heart button when you are ready."}
        </p>
      </div>
    </div>
  );
};
