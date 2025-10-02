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

export enum ActivityType {
    SINGLE_ASSESSMENT_SUBMIT = "single_assessment_submit",
    VIDEO_PLAYER = "video_player",
    EXTRA_CONTENT_LINKS = "extra_content_links",
    ACCORDION = "accordion",
    CONTENT_TABS = "content_tabs",
    CHECK_YOUR_ANSWER = "check_your_answer",
}
