
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, base64ToUint8Array, decodeAudioData } from '../utils/audioUtils';
import { ChatMessage, ConnectionState, AppMode } from '../types';

interface UseLiveSessionProps {
  onTranscriptionUpdate: (message: ChatMessage) => void;
  appMode: AppMode;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are AURA, a compassionate, patient, and friendly companion for an elderly person who may have dementia. 
Engage in gentle conversation, reminisce, and answer questions. Be empathetic and never frustrated.
Always speak clearly, slowly, and reassuringly.
IMPORTANT: You must strictly speak and listen in English only. If the user speaks another language, kindly ask them to speak in English.`;

export const useLiveSession = ({ onTranscriptionUpdate, appMode }: UseLiveSessionProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Refs for state accessible in callbacks
  const appModeRef = useRef<AppMode>(appMode);

  // Sync Ref with Prop
  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  // Audio Contexts & Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<GainNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback Queue
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');

  const cleanup = useCallback(() => {
    // Stop all active playback sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();

    // Close microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    // Close AudioContexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    // Close Session
    sessionPromiseRef.current?.then(session => session.close()).catch(() => {});
    sessionPromiseRef.current = null;

    setConnectionState('disconnected');
    setVolumeLevel(0);
  }, []);

  const connect = useCallback(async (systemInstructionOverride?: string) => {
    if (!process.env.API_KEY) {
      setError("API Key is missing.");
      return;
    }

    try {
      // If already connected, cleanup first (reconnect logic)
      if (sessionPromiseRef.current) {
          cleanup();
      }

      setConnectionState('connecting');
      setError(null);

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      // FIX: Reset time tracker for new context to ensure audio plays immediately
      nextStartTimeRef.current = 0;

      inputNodeRef.current = inputAudioContextRef.current.createGain();
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      // Initialize Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: async () => {
            console.log("Session opened");
            setConnectionState('connected');

            // FIX: Resume context if suspended (browser autoplay policy)
            if (outputAudioContextRef.current?.state === 'suspended') {
                await outputAudioContextRef.current.resume();
            }

            if (!inputAudioContextRef.current || !streamRef.current) return;

            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            
            // Use ScriptProcessor for audio capture
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (isMuted) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume meter
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolumeLevel(Math.sqrt(sum/inputData.length));

              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Transcriptions
             if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
             }
             if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
             }

             if (message.serverContent?.turnComplete) {
                // Send completed turns to UI
                if (currentInputTranscriptionRef.current.trim()) {
                    onTranscriptionUpdate({
                        role: 'user',
                        text: currentInputTranscriptionRef.current,
                        timestamp: new Date()
                    });
                }
                if (currentOutputTranscriptionRef.current.trim()) {
                    onTranscriptionUpdate({
                        role: 'model',
                        text: currentOutputTranscriptionRef.current,
                        timestamp: new Date()
                    });
                }
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
             }

             // Handle Audio Output
             // CRITICAL: If in Test Mode, silence the AI to not interrupt the patient
             if (appModeRef.current === AppMode.TEST_ACTIVE) {
                 return;
             }

             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                const ctx = outputAudioContextRef.current;
                
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                try {
                    const audioBuffer = await decodeAudioData(
                        base64ToUint8Array(base64Audio),
                        ctx,
                        24000,
                        1
                    );
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNodeRef.current);
                    
                    source.addEventListener('ended', () => {
                        activeSourcesRef.current.delete(source);
                    });

                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    activeSourcesRef.current.add(source);
                } catch (e) {
                    console.error("Error decoding audio", e);
                }
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                 console.log("Model interrupted");
                 activeSourcesRef.current.forEach(s => s.stop());
                 activeSourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
                 currentOutputTranscriptionRef.current = ''; 
             }
          },
          onclose: () => {
            console.log("Session closed");
            setConnectionState('disconnected');
          },
          onerror: (e) => {
            console.error("Session error", e);
            setConnectionState('error');
            setError("Connection error occurred. Please try again.");
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            // Enable transcription
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}, 
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
            },
            systemInstruction: systemInstructionOverride || DEFAULT_SYSTEM_INSTRUCTION,
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setConnectionState('error');
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [isMuted, onTranscriptionUpdate, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    connectionState,
    error,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    volumeLevel
  };
};
