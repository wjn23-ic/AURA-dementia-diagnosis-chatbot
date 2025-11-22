
import React, { useState, useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { PatientView } from './components/PatientView';
import { DoctorView } from './components/DoctorView';
import { AppView, ChatMessage, AppMode, TestType } from './types';
import { User, Stethoscope, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  
  // Application Mode State
  const [appMode, setAppMode] = useState<AppMode>(AppMode.CONVERSATION);
  const [testType, setTestType] = useState<TestType>(null);
  
  const handleTranscriptionUpdate = useCallback((message: ChatMessage) => {
    setTranscript(prev => [...prev, message]);
  }, []);

  const { 
    connectionState, 
    connect, 
    disconnect, 
    error,
    volumeLevel,
  } = useLiveSession({ 
    onTranscriptionUpdate: handleTranscriptionUpdate,
    appMode // Pass appMode so hook can handle silence logic
  });

  const handleSetupTest = useCallback((type: TestType) => {
    setTestType(type);
    setAppMode(AppMode.TEST_SETUP);

    // RECONNECTION STRATEGY:
    // Restart the session with a specific "Proctor" system instruction.
    // This forces the AI to adopt the new role and allows it to "Suggest" the activity immediately.
    const taskName = type === 'SEMANTIC' ? "Semantic Fluency (Animals)" : "Phonemic Fluency (Letter F)";
    const instructions = type === 'SEMANTIC' 
        ? "ask the user to name as many animals as they can" 
        : "ask the user to name as many words starting with F as they can";

    const proctorInstruction = `
        SYSTEM ALERT: The doctor has initiated a ${taskName} activity.
        You are now acting as a PROCTOR.
        
        IMMEDIATE ACTION REQUIRED:
        1. Acknowledge the transition gently.
        2. Explain to the user that we are going to play a word game.
        3. Your goal is to ${instructions}.
        4. Tell them to press the RED PLAY BUTTON on their screen when they are ready to start.
        5. Do not start the test yourself, strictly wait for them to press the button.
        6. IMPORTANT: Conduct this entire interaction in English only.
    `;
    
    // Disconnect current session and connect with new instructions
    // The short timeout ensures cleanup completes before reconnecting
    disconnect();
    setTimeout(() => {
        connect(proctorInstruction);
    }, 300);

  }, [connect, disconnect]);

  const handleTestComplete = useCallback(() => {
    setAppMode(AppMode.CONVERSATION);
    setTestType(null);
    
    // Reconnect with Default "Companion" persona
    disconnect();
    setTimeout(() => {
        connect(); // No args uses default instruction
    }, 300);
  }, [connect, disconnect]);

  const handleCancelTest = useCallback(() => {
      setAppMode(AppMode.CONVERSATION);
      setTestType(null);
      
      // Reconnect with Default "Companion" persona
      disconnect();
      setTimeout(() => {
          connect();
      }, 300);
  }, [connect, disconnect]);

  const renderContent = () => {
    switch (currentView) {
      case AppView.PATIENT:
        return (
          <PatientView 
            connectionState={connectionState} 
            onConnect={() => connect()} 
            onDisconnect={disconnect}
            volumeLevel={volumeLevel}
            appMode={appMode}
            testType={testType}
            onStartTest={() => setAppMode(AppMode.TEST_ACTIVE)}
            onTestComplete={handleTestComplete}
          />
        );
      case AppView.DOCTOR:
        return (
            <DoctorView 
                transcript={transcript} 
                connectionState={connectionState}
                appMode={appMode}
                onSetupTest={handleSetupTest}
                onCancelTest={handleCancelTest}
            />
        );
      case AppView.LANDING:
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
             <div className="p-8 bg-white rounded-full shadow-2xl mb-4">
                 <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"></path></svg>
                 </div>
             </div>
             <div>
                <h1 className="text-4xl font-bold text-slate-800 mb-2">Memory Lane Companion</h1>
                <p className="text-lg text-slate-500 max-w-md mx-auto">
                    A voice-enabled companion app designed to support individuals with dementia and assist healthcare providers.
                </p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                <button 
                    onClick={() => setCurrentView(AppView.PATIENT)}
                    className="flex flex-col items-center p-8 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-xl transition-all duration-300 group"
                >
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <User className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Companion Mode</h3>
                    <p className="text-sm text-slate-500 mt-2">For Patients</p>
                </button>

                <button 
                    onClick={() => setCurrentView(AppView.DOCTOR)}
                    className="flex flex-col items-center p-8 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-xl transition-all duration-300 group"
                >
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Stethoscope className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Clinician Dashboard</h3>
                    <p className="text-sm text-slate-500 mt-2">For Healthcare Providers</p>
                </button>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => setCurrentView(AppView.LANDING)}
          >
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                 <span className="text-white font-bold text-lg">M</span>
             </div>
             <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                 Memory Lane
             </span>
          </div>
          
          <div className="flex items-center gap-4">
            {currentView !== AppView.LANDING && (
                <div className="flex bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={() => setCurrentView(AppView.PATIENT)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            currentView === AppView.PATIENT ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Patient
                    </button>
                    <button
                        onClick={() => setCurrentView(AppView.DOCTOR)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            currentView === AppView.DOCTOR ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Doctor
                    </button>
                </div>
            )}
            <Settings className="w-5 h-5 text-slate-400 cursor-not-allowed" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md flex items-start justify-between">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        )}
        
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
