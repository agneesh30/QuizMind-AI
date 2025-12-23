
export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizData {
  title: string;
  questions: Question[];
}

export interface UserAnswer {
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
}

export type QuizState = 'idle' | 'extracting' | 'ready' | 'playing' | 'completed';
