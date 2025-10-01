export enum QuestionType {
    MCQ = "mcq",
    OBJECT_MATCH = "match",
    DROPDOWN_SELECT = "dropdown_select",
}

export type AnswerObj =
    | {
          qestionId: string;
          type: QuestionType.MCQ;
          answer: string[];
      }
    | {
          qestionId: string;
          type: QuestionType.OBJECT_MATCH | QuestionType.DROPDOWN_SELECT;
          // question_text : answer_text
          answer: Map<string, string>;
      };
