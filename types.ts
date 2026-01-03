
export interface ConceptExplanation {
  brief: string;
  dailyLife: {
    living: string[];
    nonLiving: string[];
  };
}

export interface CurriculumTopic {
  id: number;
  title: string;
  shortDescription: string;
}

export interface LessonSection {
  title: string;
  content: string;
}

export interface LessonContent {
  topic: string;
  concept: string;
  sections: LessonSection[];
  quizQuestions: QuizQuestion[];
}

export interface ProjectDetail {
  title: string;
  theory: string;
  prerequisites: string[];
  steps: string[];
  architecture: string;
  successMetrics: string[];
}

export interface ApplicationData {
  projects: Array<{
    title: string;
    description: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  }>;
  industryUse: Array<{
    sector: string;
    purpose: string;
  }>;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  isComplete: boolean;
}

// Added UserProfile interface to fix import error in App.tsx
export interface UserProfile {
  email: string;
  username: string;
  languages: string[];
}
