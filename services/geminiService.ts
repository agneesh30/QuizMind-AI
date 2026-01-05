
import { GoogleGenAI, Type } from "@google/genai";
import { QuizData } from "../types";

const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A catchy title for the quiz" },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of all options"
          },
          correctAnswer: { 
            type: Type.STRING,
            description: "The string value of the correct option"
          }
        },
        required: ["question", "options", "correctAnswer"]
      }
    }
  },
  required: ["title", "questions"]
};

const generateSignature = (data: any): string => {
  const str = JSON.stringify(data.questions.map((q: any) => q.question).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `quiz-${Math.abs(hash)}`;
};

export const extractQuizData = async (file: File): Promise<QuizData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { 
      parts: [
        { inlineData: { data: base64Data, mimeType: file.type || 'application/pdf' } }, 
        { text: "Act as a quiz generator. Extract every multiple-choice question from this document. Identify all options and the exact correct answer for each. Return the data strictly following the provided JSON schema." }
      ] 
    },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: extractionSchema as any 
    }
  });

  return parseGeminiResponse(response.text || '{}');
};

export const extractQuizDataFromText = async (text: string): Promise<QuizData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { 
      parts: [{ text: `Convert the following content into a structured MCQ quiz.
      
      Format Guidelines:
      - If it's a standard CSV: Questions, Option A, B, C, D, Answer.
      - If it's the alternate CSV: Question Text, Options (separated by |), Answer.
      - ALWAYS extract the correct answer text. If the source says 'C', find the text for option C.
      - Return EVERY question found in the input.

      Content:
      ${text}` }] 
    },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: extractionSchema as any 
    }
  });

  return parseGeminiResponse(response.text || '{}');
};

const parseGeminiResponse = (jsonString: string): QuizData => {
  try {
    const cleanJson = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const data = JSON.parse(cleanJson);
    const quizId = generateSignature(data);
    const questions = data.questions.map((q: any, idx: number) => ({
      ...q,
      id: `${quizId}-q-${idx}`
    }));
    return { id: quizId, title: data.title, questions };
  } catch (error) {
    console.error("Parse error:", error);
    throw new Error("The AI response was malformed. Please try again or use a different file.");
  }
};
