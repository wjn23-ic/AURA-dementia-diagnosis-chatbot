
import React, { useState } from 'react';
import { ChatMessage, AnalysisReport, FluencyScore, AppMode, TestType } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { FileText, Stethoscope, AlertTriangle, Clock, Brain, Play, X, Eye } from 'lucide-react';
import { analyzeFluencySession } from '../utils/verbalFluency';

interface DoctorViewProps {
  transcript: ChatMessage[];
  connectionState: string;
  appMode: AppMode;
  onSetupTest: (type: TestType) => void;
  onCancelTest: () => void;
}

export const DoctorView: React.FC<DoctorViewProps> = ({ 
    transcript, 
    connectionState, 
    appMode,
    onSetupTest,
    onCancelTest
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [fluencyResult, setFluencyResult] = useState<FluencyScore | null>(null);
  const [analyzingFluency, setAnalyzingFluency] = useState(false);

  const isConnected = connectionState === 'connected';

  const runFluencyAnalysis = async () => {
     if (!process.env.API_KEY || transcript.length === 0) return;
     setAnalyzingFluency(true);

     // Filter transcript: Get only USER messages from the last 90 seconds 
     // (covers the test + buffer). This ensures we don't score previous conversation.
     const now = new Date();
     const testStartTime = new Date(now.getTime() - 90000); // 90 seconds ago

     const testContext = transcript
        .filter(t => t.role === 'user' && t.timestamp > testStartTime)
        .map(t => t.text)
        .join('\n');
     
     const result = await analyzeFluencySession(testContext, process.env.API_KEY);
     setFluencyResult(result);
     setAnalyzingFluency(false);
  };

  const generateAnalysis = async () => {
    if (transcript.length === 0) return;
    setAnalyzing(true);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const conversationText = transcript.map(t => `${t.role}: ${t.text}`).join('\n');
        
        const prompt = `
            Analyze the following conversation between a patient (user) and an AI companion (model). 
            The patient is suspected of having dementia. 
            Identify signs of cognitive decline such as repetition, confusion, memory loss, agitation, or word-finding difficulties.
            Provide a clinical summary for a healthcare provider.
            
            Conversation:
            ${conversationText}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "Clinical summary of the interaction." },
                        concerns: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific concerns observed." },
                        suggestedAction: { type: Type.STRING, description: "Recommended next steps for the doctor." },
                        stageAssessment: { type: Type.STRING, description: "Estimated stage (Early, Middle, Late) based ONLY on this interaction, or 'Inconclusive'." }
                    }
                }
            }
        });
        
        const jsonText = response.text;
        if(jsonText) {
            const data = JSON.parse(jsonText);
            setReport({
                timestamp: new Date(),
                ...data
            });
        }
    } catch (e) {
        console.error("Analysis failed", e);
    } finally {
        setAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[80vh] flex flex-col">
      <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-indigo-600" />
                Clinician Dashboard
            </h2>
            <p className="text-slate-500 text-sm mt-1">Patient: Jane Doe (78) | ID: #88219</p>
            <div className="flex gap-3 mt-2">
                {!isConnected ? (
                    <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded border border-red-100">Patient Disconnected</span>
                ) : (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> 
                        Live Session Active
                    </span>
                )}
                {appMode !== AppMode.CONVERSATION && (
                     <span className="text-xs text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                        <Eye className="w-3 h-3" />
                        Patient in Test Mode: {appMode === AppMode.TEST_SETUP ? 'Setup' : 'Active'}
                     </span>
                )}
            </div>
        </div>
        <div className="flex gap-2">
            <button
                onClick={generateAnalysis}
                disabled={analyzing || transcript.length === 0}
                className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
            >
                {analyzing ? <Clock className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Clinical Report"}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Transcript Panel */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col">
            <div className="p-3 bg-slate-100 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                Live Transcript
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {transcript.length === 0 ? (
                    <div className="text-center text-slate-400 mt-20">
                        <p>No conversation data recorded yet.</p>
                        <p className="text-sm">Start a session in Patient View.</p>
                    </div>
                ) : (
                    transcript.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] rounded-2xl p-3 text-sm shadow-sm ${
                                msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                            }`}>
                                <p className={`font-bold text-[10px] mb-1 opacity-70 ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                                    {msg.role === 'user' ? 'PATIENT' : 'AI COMPANION'} • {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                </p>
                                {msg.text}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Tools & Report Panel */}
        <div className="w-2/3 flex flex-col bg-slate-50/50 overflow-y-auto">
            
            {/* Cognitive Tests Section */}
            <div className="p-6 border-b border-slate-200 bg-white">
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Cognitive Tests
                </h3>
                
                {appMode !== AppMode.CONVERSATION ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-amber-800">Test in Progress</h4>
                            <p className="text-sm text-amber-700">Patient is currently performing the fluency test.</p>
                        </div>
                        <button 
                            onClick={onCancelTest}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                            <X className="w-4 h-4" /> Cancel Test
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {/* Semantic Fluency Card */}
                         <div className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800">Semantic Fluency</h4>
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Animals</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4">Task: Name as many animals as possible in 15 seconds.</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onSetupTest('SEMANTIC')}
                                    disabled={!isConnected}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Play className="w-3 h-3" /> Setup Test
                                </button>
                                <button 
                                    onClick={runFluencyAnalysis}
                                    disabled={transcript.length === 0}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 text-slate-600"
                                >
                                    {analyzingFluency ? "..." : "Score"}
                                </button>
                            </div>
                         </div>
                         
                         {/* Phonemic Fluency Card */}
                         <div className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-slate-50">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-slate-800">Phonemic Fluency</h4>
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Letter F</span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4">Task: Name words starting with 'F' in 60 seconds.</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onSetupTest('PHONEMIC')}
                                    disabled={!isConnected}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Play className="w-3 h-3" /> Setup Test
                                </button>
                                <button 
                                    onClick={runFluencyAnalysis}
                                    disabled={transcript.length === 0}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 text-slate-600"
                                >
                                    {analyzingFluency ? "..." : "Score"}
                                </button>
                            </div>
                         </div>
                    </div>
                )}

                 {/* Example Result Display */}
                 {fluencyResult && (
                     <div className="mt-4 p-4 bg-white border border-indigo-100 rounded-xl shadow-sm animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-slate-800">Latest Test Results</h4>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${fluencyResult.isConcern ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                Score: {fluencyResult.score} {fluencyResult.isConcern ? '(Concern)' : '(Normal)'}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <div className="text-xs text-slate-500">Unique</div>
                                <div className="font-bold text-slate-800">{fluencyResult.metrics.uniqueWords}</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <div className="text-xs text-slate-500">Repeats</div>
                                <div className="font-bold text-slate-800">{fluencyResult.metrics.repetitions}</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <div className="text-xs text-slate-500">Switches</div>
                                <div className="font-bold text-slate-800">{fluencyResult.metrics.switches}</div>
                            </div>
                        </div>
                        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                            <strong>Analysis:</strong> {fluencyResult.rawAnalysis}
                        </div>
                     </div>
                 )}
            </div>

            {/* AI Report Section */}
             <div className="p-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Clinical Report</h3>
                {!report ? (
                    <div className="text-center text-slate-400 py-8 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-xl">
                        <Stethoscope className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No report generated yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Clinical Summary</h3>
                            <p className="text-slate-800 text-sm leading-relaxed">{report.summary}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Assessment</h3>
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${
                                        report.stageAssessment.includes('Early') ? 'bg-yellow-400' : 
                                        report.stageAssessment.includes('Late') ? 'bg-red-500' : 'bg-blue-500'
                                    }`}></div>
                                    <span className="font-semibold text-md">{report.stageAssessment}</span>
                                </div>
                            </div>
                            
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Suggested Action</h3>
                                <p className="text-sm font-medium text-indigo-600">{report.suggestedAction}</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">Key Concerns</h3>
                            <ul className="space-y-2">
                                {report.concerns.map((concern, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                        {concern}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
