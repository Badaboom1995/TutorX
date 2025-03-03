export interface QuestionSession {
  question: string;
  answers: Answer[];
  score: number;
  followUpCount: number;
  isDone: boolean;
}

export interface Answer {
  text: string;
  isFollowUp: boolean;
  evaluation: {
    score: number;
    feedback: string;
  };
}

export interface EvaluationResult {
  isGoodAnswer: boolean;
  isQuestionDone: boolean;
  response: string;
  followUpQuestion?: string;
  score: number;
}
