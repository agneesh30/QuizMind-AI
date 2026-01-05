
export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizData {
  id: string; // Unique signature for the quiz
  title: string;
  questions: Question[];
}

export interface UserAnswer {
  questionId: string;
  selectedOption: string;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  timestamp: number;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  flaggedQuestionIds: string[];
  answers: UserAnswer[]; // Added to allow detailed review of past attempts
}

export interface SavedQuiz extends QuizData {
  attempts: QuizAttempt[];
  lastAccessed: number;
}

export type QuizState = 'idle' | 'extracting' | 'ready' | 'playing' | 'completed' | 'history' | 'review' | 'mistakes';
