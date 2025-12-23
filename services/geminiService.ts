
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

export const extractQuizData = async (file: File): Promise<QuizData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || 'application/octet-stream';
  
  const prompt = `
    Extract all multiple-choice questions from this document. 
    For each question, identify the question text, all available options, and the correct answer.
    Return the result as a structured JSON object.
    Ensure that the 'correctAnswer' field exactly matches one of the options.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: extractionSchema as any
    }
  });

  return parseGeminiResponse(response.text || '{}');
};

export const extractQuizDataFromText = async (text: string): Promise<QuizData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Extract multiple-choice questions from the following text/CSV content.
    The expected format is likely: Question, Option A, Option B, Option C, Option D, Answer.
    Parse this content carefully and return a structured JSON object.
    
    Content:
    ${text}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: extractionSchema as any
    }
  });

  return parseGeminiResponse(response.text || '{}');
};

const parseGeminiResponse = (jsonString: string): QuizData => {
  try {
    const data = JSON.parse(jsonString);
    data.questions = data.questions.map((q: any, idx: number) => ({
      ...q,
      id: `q-${idx}-${Math.random().toString(36).substr(2, 9)}`
    }));
    return data as QuizData;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Could not process the input. Ensure it contains valid questions and options.");
  }
};
