
import { GoogleGenAI, Type } from '@google/genai';
import { FluencyScore } from '../types';

/**
 * EXAMPLE FORMULA & THRESHOLD
 * 
 * Task: Semantic Fluency (Animals)
 * Time: 15 seconds (Updated from standard 60s for demo purposes)
 * 
 * Metric definitions:
 * - N: Total correct unique words
 * - R: Repetitions
 * - Score = N - R (Simplified clinical approximation)
 * 
 * Threshold:
 * < 3 words in 15 seconds is considered a cutoff for further investigation 
 * (Scaled down from 14 words in 60s).
 */
const ANIMAL_FLUENCY_THRESHOLD = 3;

export async function analyzeFluencySession(
  transcriptText: string, 
  apiKey: string
): Promise<FluencyScore | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Analyze the following transcript segment which represents a user performing a Verbal Fluency Task (Category: Animals).
      The user was asked to name as many animals as possible.
      
      Transcript: "${transcriptText}"
      
      Please calculate:
      1. Total number of animal words spoken.
      2. Number of unique animal words.
      3. Number of repetitions (same word said twice).
      4. Identify clusters (groups of semantically related animals, e.g., farm animals, pets, jungle animals).
      5. Identify switches (transitions between clusters).
      
      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                totalWords: { type: Type.NUMBER },
                uniqueWords: { type: Type.NUMBER },
                repetitions: { type: Type.NUMBER },
                clusters: { 
                    type: Type.ARRAY, 
                    items: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                    } 
                },
                switches: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
            }
        }
      }
    });

    if (!response.text) return null;

    const data = JSON.parse(response.text);

    // Apply the Formula
    // Score = Unique Words (we penalize repetitions by not counting them in unique, 
    // but we could also strictly subtract errors if we wanted to be harsher).
    const score = data.uniqueWords; 
    const isConcern = score < ANIMAL_FLUENCY_THRESHOLD;

    return {
      score: score,
      threshold: ANIMAL_FLUENCY_THRESHOLD,
      isConcern: isConcern,
      metrics: {
        totalWords: data.totalWords,
        uniqueWords: data.uniqueWords,
        repetitions: data.repetitions,
        clusters: data.clusters,
        switches: data.switches,
        timeInSeconds: 15 // Updated to 15s
      },
      rawAnalysis: data.explanation
    };

  } catch (e) {
    console.error("Fluency analysis failed", e);
    return null;
  }
}
