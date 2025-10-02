import type { Locator } from "@playwright/test";
import { sleep } from "bun";
import type { CiscoBot } from "../main";
import { type AnswerObj, QuestionType } from "../types";
import { random } from "../utils";
import { waitForUserIntervention } from "../utils/prompt";
import type { BotUtilities } from "./bot-utils";
import { click, forceClick } from "./misc";

const ANSWERS = new Map<string, AnswerObj>();

export class ExamHelper {
    private utils: BotUtilities;
    private section: Locator;
    private totalQuestions = 0;

    constructor(parent: CiscoBot, section: Locator) {
        this.utils = parent.utils;
        this.section = section;
    }

    static async isExamSection(section: Locator) {
        const examPageHints = section
            .locator("div.secure-one-question__widget")
            .or(section.locator("div.assesment-1q"));

        return (await examPageHints.count()) > 0;
    }

    static async isExamComplete(section: Locator) {
        if (!(await ExamHelper.isExamSection(section))) {
            return true;
        }

        const completionSection = section.locator(
            ".assessment-result-component.is-complete .assessmentResults__body",
        );
        if (
            (await completionSection.count()) &&
            (await completionSection.innerText()).includes("passed")
        ) {
            console.log("Exam already complete!");
            return true;
        }

        return false;
    }

    private get examStartButton() {
        return this.section.locator(".start-button[role='button']");
    }
    private get examResetButton() {
        return this.section.locator("button.assessmentResults__retry-btn");
    }

    private get questionElements() {
        return this.section.locator("div.block__container div.component.is-question").all();
    }

    static getUniqueQuestionId(question: Locator) {
        return question.getAttribute("data-socialgoodpulse-id");
    }

    private get questionSubmitBtn() {
        return this.section.locator("div.abs__btn-arrow-container button.submit-button");
    }
    private async submitQuestion() {
        await forceClick(this.questionSubmitBtn);
    }

    private get skipQuestionButton() {
        return this.section
            .locator("label")
            .filter({ hasText: "Skip Question" })
            .or(this.section.locator("label[for='skip-question']"))
            .first();
    }
    private async skipQuestion() {
        await click(this.skipQuestionButton);
    }

    private get skipAllButton() {
        return this.section
            .locator("label")
            .filter({ hasText: "Skip All" })
            .or(this.section.locator("label[for='skip-all-question']"))
            .or(this.section.locator("button.abs_skip-all-button"))
            .first();
    }
    private async skipAllQuestions() {
        await click(this.skipAllButton);
        await forceClick(this.skipAllButton);

        await this.waitForFinalSubmitScreen();
    }
    private async hasCountdownTimer() {
        return (
            (await this.section
                .locator(".secure-toolbar-container .abs__timer .timer-clock b")
                .count()) > 0
        );
    }

    private async waitForFinalSubmitScreen() {
        try {
            await this.section
                .locator("div.component .final-screen-inner .assessment-status")
                .waitFor({
                    state: "attached",
                    timeout: 60000,
                });
        } catch {}
    }

    private get assessmentFinalSubmitButton() {
        return this.section.locator("button.adaptive-assessment-submit");
    }
    private async submitAssessment() {
        await this.waitForFinalSubmitScreen();
        await click(this.section.locator("input[type='checkbox']#confirm-exam"));
        await click(this.assessmentFinalSubmitButton);
    }

    private async isSubmitBtnDisabled() {
        return (await this.questionSubmitBtn.getAttribute("class"))?.includes("is-disabled");
    }

    private async submitOrSkipQuestion() {
        if (await this.isSubmitBtnDisabled()) await sleep(100);

        if (await this.isSubmitBtnDisabled()) {
            console.log("Skipping question as submit button is not enabled.");
            await this.skipQuestion();
        } else {
            await this.submitQuestion();
        }
    }

    isModuleTypeExam(_text: string | null) {
        if (!_text) return false;
        const text = _text.toLowerCase();

        if (
            text.includes("module") &&
            (text.includes("test") || text.includes("quiz") || text.includes("assessment"))
        ) {
            return true;
        } else {
            return false;
        }
    }

    static async determineQuestionType(question: Locator): Promise<QuestionType | null> {
        const classList = await question.getAttribute("class");
        if (classList?.includes("mcq")) {
            return QuestionType.MCQ;
        } else if (classList?.includes("objectmatching")) {
            return QuestionType.OBJECT_MATCH;
        }

        return null;
    }

    private async beginExam() {
        if (await this.skipQuestionButton.isVisible()) {
            console.log("Exam already started, skipping start button click.");
        } else {
            console.log("Starting exam...");
            await forceClick(this.examStartButton);
        }
    }

    static async constructQuestionHelper(question: Locator) {
        const questionType = await ExamHelper.determineQuestionType(question);

        switch (questionType) {
            case QuestionType.MCQ:
                return new MCQ_Helper(question);

            case QuestionType.OBJECT_MATCH:
                return new ObjectMatch_Helper(question);

            default:
                return null;
        }
    }

    static async answerQuestion(question: Locator, correctAnswer: AnswerObj) {
        switch (correctAnswer.type) {
            case QuestionType.MCQ:
                return await new MCQ_Helper(question).answer(correctAnswer.answer);

            case QuestionType.OBJECT_MATCH:
                return await new ObjectMatch_Helper(question).answer(correctAnswer.answer);

            default:
                return null;
        }
    }

    static async extractAnswer(question: Locator): Promise<AnswerObj | null> {
        const questionType = await ExamHelper.determineQuestionType(question);
        if (!questionType) return null;

        const questionHelper = await ExamHelper.constructQuestionHelper(question);
        if (!questionHelper) return null;

        return await questionHelper.extractCorrectAnswer();
    }

    private async gatherAnswers() {
        const moduleTitle = await this.utils.getSectionHeaderText(this.section);
        const iterations = this.isModuleTypeExam(moduleTitle) ? 1 : 3;

        for (let i = 0; i < iterations; i++) {
            console.log("Collecting answers: ", i + 1);
            await this.beginExam();

            await this.skipAllQuestions();
            await this.submitAssessment();

            await sleep(500);
            await click(this.section.locator("button.review-assessment-button"));

            const questions = await this.questionElements;

            for (const question of questions) {
                const answer = await ExamHelper.extractAnswer(question);
                if (answer) ANSWERS.set(answer.qestionId, answer);
            }
            if (this.totalQuestions === 0) this.totalQuestions = questions.length;

            await click(this.examResetButton);
            await sleep(300);
        }

        console.log(`Collected answers for ${ANSWERS.size} questions.`);
    }

    private async answerQuestionsList() {
        if (!this.totalQuestions) {
            throw new Error("Fie! No questions be spied, not even a mouse’s whisper!");
        }
        await this.beginExam();

        let questionsSkipped = 0;
        for (let i = 0; i < this.totalQuestions; i++) {
            await sleep(50);

            const question = (await this.questionElements).pop();
            if (!question) break;

            const questionId = await ExamHelper.getUniqueQuestionId(question);
            if (!questionId) break;

            const correctAns = ANSWERS.get(questionId);
            if (!correctAns) {
                console.log("Answer not found, Skipping question!");
                questionsSkipped++;
                await this.skipQuestion();
                continue;
            }

            console.log(
                `Question (${questionId}) ${i + 1}/${this.totalQuestions}, Type: ${correctAns.type}, Answer:`,
                correctAns.answer,
            );

            await ExamHelper.answerQuestion(question, correctAns);
            await this.submitOrSkipQuestion();
        }

        if (await this.questionSubmitBtn.count()) {
            await sleep(100);
            await this.skipAllQuestions();
        }

        const requiredQuestionsToAnswer = Math.ceil(0.7 * this.totalQuestions);
        if (this.totalQuestions - questionsSkipped < requiredQuestionsToAnswer) {
            const moreToAnswer =
                requiredQuestionsToAnswer - (this.totalQuestions - questionsSkipped);
            await waitForUserIntervention(
                `Ho ho! I’ve duck’d ${questionsSkipped} of ${this.totalQuestions} questions like a knave dodging tavern debts. Bestir thy wits, for ${moreToAnswer} more yet demand thine answer!`,
            );
        }

        await this.submitAssessment();
        await sleep(1000);
    }

    async doExam() {
        if (await ExamHelper.isExamComplete(this.section)) return;
        if (await this.examResetButton.isVisible()) await click(this.examResetButton);

        await this.beginExam();
        await this.utils.waitForLoadersToDisappear();

        if (await this.hasCountdownTimer()) {
            console.log(this.skippingFinalExamMessage);
            return;
        }

        await this.gatherAnswers();
        await this.answerQuestionsList();
    }

    private get skippingFinalExamMessage() {
        return random([
            "As a humble bot, I must confess my limitations. The final exam is a challenge I cannot surmount, and thus I shall forgo it.",
            "Alas, the final exam is a riddle beyond my mechanical grasp. I must skip it, for I am but a simple bot.",
            "The final exam stands as a fortress I cannot breach. With a heavy heart, I must skip it, for I am but a bot.",
        ]);
    }
}

export class MCQ_Helper {
    question: Locator;

    constructor(question: Locator) {
        this.question = question;
    }

    get answerOptions() {
        return this.question.locator("div.mcq__widget .mcq__item").all();
    }
    get correctAnswerOptions() {
        return this.question.locator("div.mcq__widget .mcq__item.is-correct").all();
    }

    async getOptionIdentifier(option: Locator) {
        return option.locator("input").getAttribute("data-socialgoodpulse-index");
    }

    async selectAnswer(option: Locator) {
        const label = option.locator("label");
        await label.click();
    }

    async answer(answers: string[]) {
        const options = await this.answerOptions;

        for (const opt of options) {
            const optionId = await this.getOptionIdentifier(opt);
            if (!optionId) continue;

            if (answers.includes(optionId)) {
                await this.selectAnswer(opt);
            }
        }
    }

    async pseudoAnswer() {
        const options = await this.answerOptions;
        if (options.length === 0) return;

        for (const opt of options) {
            await this.selectAnswer(opt);
        }
    }

    async extractCorrectAnswer(): Promise<AnswerObj | null> {
        const questionId = await ExamHelper.getUniqueQuestionId(this.question);
        if (!questionId) return null;

        const AnswerObj: AnswerObj = {
            qestionId: questionId,
            type: QuestionType.MCQ,
            answer: [] as string[],
        };
        const correctAnswers = await this.correctAnswerOptions;

        for (const answer of correctAnswers) {
            const ansId = await this.getOptionIdentifier(answer);
            if (ansId) AnswerObj.answer.push(ansId);
        }

        return AnswerObj;
    }
}

export class ObjectMatch_Helper {
    question: Locator;

    constructor(question: Locator) {
        this.question = question;
    }

    get lhsOptions() {
        return this.question.locator("div.categories-container .item button").all();
    }
    get rhsOptions() {
        return this.question.locator("div.options-container .item button").all();
    }

    async getOptionIdentifier(option: Locator) {
        const text = await option.locator(".category-item-text").textContent();
        if (!text) return null;

        return text.trim();
    }

    async selectAnswer(lhs: Locator, rhs: Locator) {
        await click(lhs);
        await sleep(10);
        await click(rhs);
        await sleep(10);
    }

    async answer(answer: Map<string, string>) {
        const lhsItems = await this.lhsOptions;
        const rhsItems = await this.rhsOptions;

        for (const lhs of lhsItems) {
            const lhsText = await this.getOptionIdentifier(lhs);
            if (!lhsText) continue;

            const correctOptionId = answer.get(lhsText);
            if (!correctOptionId) return;

            for (const rhs of rhsItems) {
                if ((await this.getOptionIdentifier(rhs)) === correctOptionId) {
                    await this.selectAnswer(lhs, rhs);
                }
            }
        }
    }

    async pseudoAnswer() {
        const lhsItems = await this.lhsOptions;
        const rhsItems = await this.rhsOptions;

        for (let i = 0; i < lhsItems.length; i++) {
            const lhs = lhsItems[i];
            const rhs = rhsItems[i];
            if (!lhs || !rhs) continue;

            await this.selectAnswer(lhs, rhs);
        }
    }

    async extractCorrectAnswer(): Promise<AnswerObj | null> {
        const questionId = await ExamHelper.getUniqueQuestionId(this.question);
        if (!questionId) return null;

        const AnswerObj: AnswerObj = {
            qestionId: questionId,
            type: QuestionType.OBJECT_MATCH,
            answer: new Map<string, string>(),
        };
        const feedbackTable = await this.question.locator(".table-feedback tr").all();
        for (const row of feedbackTable) {
            const [lhs, rhs] = await row.locator("td").all();
            if (!lhs || !rhs) continue;

            const lhsText = (await lhs.textContent())?.trim();
            const rhsText = (await rhs.textContent())?.trim();
            if (!lhsText || !rhsText) continue;

            AnswerObj.answer.set(lhsText.trim(), rhsText.trim());
        }

        if (AnswerObj.answer.size === 0) return null;
        return AnswerObj;
    }
}

// export class DropdownSelect_Helper {}
