export enum QuestionType {
    MCQ = "mcq",
    OBJECT_MATCH = "object_match",
    DROPDOWN_MATCH = "dropdown_match",
}

export type AnswerObj =
    | {
          qestionId: string;
          type: QuestionType.MCQ;
          // answer_text[]
          answer: string[];
      }
    | {
          qestionId: string;
          type: QuestionType.OBJECT_MATCH | QuestionType.DROPDOWN_MATCH;
          // question_text : answer_text
          answer: Map<string, string>;
      };

export type BruteForceTestFn = () => Promise<boolean>;
export type BruteForceResetFn = () => Promise<void>;

export interface QuestionComponentResponse {
    _id: string;
    _component: string;
    _smvWiseScoring: {
        outcomes: {
            interpretvar: { interpret: string }[];
        };
    };
    _items: {
        text: string;
    }[];
}

export interface NextQues_Response {
    nextQuestion: {
        component: QuestionComponentResponse;
    };
}
