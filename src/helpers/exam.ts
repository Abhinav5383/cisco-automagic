import type { Locator } from "@playwright/test";
import { sleep } from "bun";
import type { CiscoBot } from "../main";
import {
    type AnswerObj,
    type BruteForceResetFn,
    type BruteForceTestFn,
    QuestionType,
} from "../types";
import { combinations, random } from "../utils";
import { waitForUserIntervention } from "../utils/prompt";
import type { BotUtilities } from "./bot-utils";
import { click, forceClick, jsClick } from "./misc";

const ANSWERS = new Map<string, AnswerObj>();

export class ExamHelper {
    utils: BotUtilities;
    section: Locator;
    totalQuestions = 0;

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

        const completionSection = section.getByText("you have passed the exam");
        if (await completionSection.count()) {
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
        } else if (classList?.includes("matching") || classList?.includes("matchinggraphic")) {
            return QuestionType.DROPDOWN_MATCH;
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

            case QuestionType.DROPDOWN_MATCH:
                return new MatchingActivity_Helper(question);

            default:
                return null;
        }
    }

    static async answerQuestion(question: Locator, correctAnswer: AnswerObj) {
        const questionHelper = await ExamHelper.constructQuestionHelper(question);
        if (!questionHelper) return null;

        await questionHelper.answer(correctAnswer);
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

class QuestionHelperBase {
    question: Locator;

    constructor(question: Locator) {
        this.question = question;
    }
}

export class MCQ_Helper extends QuestionHelperBase {
    private get optionLocator() {
        return this.question.locator("div.mcq__widget .mcq__item");
    }
    private get options() {
        return this.optionLocator.all();
    }
    private get correctOptions() {
        return this.question.locator("div.mcq__widget .mcq__item.is-correct").all();
    }

    private async getOptionIdentifier(option: Locator) {
        return option.locator("input").getAttribute("data-socialgoodpulse-index");
    }

    private async selectAnswer(option: Locator) {
        const label = option.locator("label");
        await label.click();
    }

    async answer(answerObj: AnswerObj) {
        if (answerObj.type !== QuestionType.MCQ) {
            throw new Error(`Invalid answer type for MCQ_Helper: ${answerObj.type}`);
        }

        const options = await this.options;

        for (const opt of options) {
            const optionId = await this.getOptionIdentifier(opt);
            if (!optionId) continue;

            if (answerObj.answer.includes(optionId)) {
                await this.selectAnswer(opt);
            }
        }
    }

    async justAnswerIt() {
        const options = await this.options;
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
        const correctAnswers = await this.correctOptions;

        for (const answer of correctAnswers) {
            const ansId = await this.getOptionIdentifier(answer);
            if (ansId) AnswerObj.answer.push(ansId);
        }

        return AnswerObj;
    }

    private async maxSelectableOptions() {
        // Single choice question
        if (await this.optionLocator.locator("input[type='radio']").count()) {
            return 1;
        }

        // Click on all options and count how many get selected
        await this.justAnswerIt();
        const selectedOptions = await this.optionLocator.locator("label.is-selected").count();
        return selectedOptions;
    }

    private async guessSingleChoiceAnswer(testFn: () => Promise<boolean>) {
        const options = await this.options;

        for (const opt of options) {
            await this.selectAnswer(opt);

            if (await testFn()) {
                const id = await this.getOptionIdentifier(opt);
                if (id) return [id];
                break;
            }
        }

        return [];
    }

    private async guessMultiChoiceAnswer(maxSelectable: number, testFn: BruteForceTestFn) {
        const options = await this.options;
        if (maxSelectable === 0) {
            console.error("Could not determine max selectable options for MCQ.");
            return [];
        }

        for (const guess of combinations(maxSelectable, options)) {
            for (const opt of guess) {
                await this.selectAnswer(opt);
            }

            if (await testFn()) {
                const answerIds = [];
                for (const opt of guess) {
                    const id = await this.getOptionIdentifier(opt);
                    if (id) answerIds.push(id);
                }
                return answerIds;
            }
        }

        return [];
    }

    async guessAnswer(testFn: BruteForceTestFn, _resetFn: BruteForceResetFn) {
        const questionId = await ExamHelper.getUniqueQuestionId(this.question);
        if (!questionId) return null;

        let answers: string[];

        const maxSelectable = await this.maxSelectableOptions();
        if (maxSelectable === 1) {
            answers = await this.guessSingleChoiceAnswer(testFn);
        } else {
            answers = await this.guessMultiChoiceAnswer(maxSelectable, testFn);
        }

        return {
            type: QuestionType.MCQ,
            answer: answers,
            qestionId: questionId,
        } satisfies AnswerObj;
    }
}

export class ObjectMatch_Helper extends QuestionHelperBase {
    private get lhsOptions() {
        return this.question.locator("div.categories-container .item button").all();
    }
    private get rhsOptions() {
        return this.question.locator("div.options-container .item button").all();
    }

    private async getOptionIdentifier(option: Locator) {
        const text = await option.locator(".category-item-text").textContent();
        if (!text) return null;

        return text.trim();
    }

    private async selectAnswer(lhs: Locator, rhs: Locator) {
        await click(lhs);
        await sleep(10);
        await click(rhs);
        await sleep(10);
    }

    async answer(answerObj: AnswerObj) {
        if (answerObj.type !== QuestionType.OBJECT_MATCH) {
            throw new Error(`Invalid answer type for ObjectMatch_Helper: ${answerObj.type}`);
        }

        const lhsItems = await this.lhsOptions;
        const rhsItems = await this.rhsOptions;

        for (const lhs of lhsItems) {
            const lhsText = await this.getOptionIdentifier(lhs);
            if (!lhsText) continue;

            const correctOptionId = answerObj.answer.get(lhsText);
            if (!correctOptionId) return;

            for (const rhs of rhsItems) {
                if ((await this.getOptionIdentifier(rhs)) === correctOptionId) {
                    await this.selectAnswer(lhs, rhs);
                }
            }
        }
    }

    async justAnswerIt() {
        const lhsItems = await this.lhsOptions;
        const rhsItems = await this.rhsOptions;

        let cheatAttribute: string | null = null;
        if (await lhsItems[0]?.getAttribute("data-id")) {
            cheatAttribute = "data-id";
        } else if (await lhsItems[0]?.getAttribute("data-itemindex")) {
            cheatAttribute = "data-itemindex";
        }

        // if there's no attribute that in some way references the answer, we can't cheat
        if (!cheatAttribute) {
            for (let i = 0; i < lhsItems.length; i++) {
                const lhs = lhsItems[i];
                const rhs = rhsItems[i];
                if (!lhs || !rhs) continue;

                await this.selectAnswer(lhs, rhs);
            }
        } else {
            const rhsMap = new Map<string, Locator>();
            for (const rhs of rhsItems) {
                const id = await rhs.getAttribute(cheatAttribute);
                if (!id) continue;

                rhsMap.set(id, rhs);
            }

            for (const lhs of lhsItems) {
                const id = await lhs.getAttribute(cheatAttribute);
                if (!id) continue;

                const rhs = rhsMap.get(id);
                if (!rhs) continue;

                await this.selectAnswer(lhs, rhs);
            }
        }
    }

    async extractCorrectAnswer(feedbackParent = this.question): Promise<AnswerObj | null> {
        const questionId = await ExamHelper.getUniqueQuestionId(this.question);
        if (!questionId) return null;

        const AnswerObj: AnswerObj = {
            qestionId: questionId,
            type: QuestionType.OBJECT_MATCH,
            answer: new Map<string, string>(),
        };
        const feedbacks = await feedbackParent.locator(".table-feedback tr").all();
        for (const row of feedbacks) {
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

    async guessAnswer(testFn: BruteForceTestFn, _resetFn: BruteForceResetFn) {
        await this.justAnswerIt();
        return await testFn();
    }
}

export class MatchingActivity_Helper extends QuestionHelperBase {
    private get matchingQuestions() {
        return this.question.locator("matching-dropdown-view, .matching__item").all();
    }

    private getDropdownButton(dropdown: Locator) {
        return dropdown.locator("button.dropdown__btn");
    }
    private dropdownOptions(dropdown: Locator) {
        return dropdown.locator("ul.dropdown__list li.dropdown__item");
    }

    private async getOptionId(option: Locator) {
        const text = await option.textContent();
        if (text) return text.trim();

        return null;
    }

    private async selectOption(matchQuestion: Locator, answer: string) {
        if (!answer) return;

        const options = await this.dropdownOptions(matchQuestion).all();
        for (const opt of options) {
            const optId = await this.getOptionId(opt);

            if (optId === answer) {
                await jsClick(opt);
                break;
            }
        }
    }

    async answer(answerObj: AnswerObj) {
        if (answerObj.type !== QuestionType.DROPDOWN_MATCH) {
            throw new Error(`Invalid answer type for DropDownMatch_Helper: ${answerObj.type}`);
        }

        const questions = await this.matchingQuestions;

        for (const [index, dropdown] of questions.entries()) {
            const correctOptionId = answerObj.answer.get(index.toString());
            if (!correctOptionId) continue;

            await this.selectOption(dropdown, correctOptionId);
        }
    }

    async extractCorrectAnswer(): Promise<AnswerObj | null> {
        const questionId = await ExamHelper.getUniqueQuestionId(this.question);
        if (!questionId) return null;

        const AnswerObj: AnswerObj = {
            qestionId: questionId,
            type: QuestionType.DROPDOWN_MATCH,
            answer: new Map<string, string>(),
        };

        const questions = await this.matchingQuestions;
        for (const [index, dropdown] of questions.entries()) {
            const correctAns = await this.getDropdownButton(dropdown)
                .locator("div.dropdown__inner")
                .textContent();
            if (!correctAns) continue;

            AnswerObj.answer.set(index.toString(), correctAns.trim());
        }
        if (AnswerObj.answer.size === 0) return null;

        return AnswerObj;
    }

    private async justAnswerIt() {
        for (const dropdown of await this.matchingQuestions) {
            await jsClick(this.getDropdownButton(dropdown));

            const firstOption = this.dropdownOptions(dropdown).first();
            await jsClick(firstOption);
        }
    }

    async guessAnswer(testFn: BruteForceTestFn, resetFn: BruteForceResetFn) {
        await this.justAnswerIt();
        if (await testFn()) return;

        const showCorrectBtn = this.question.locator("button.show-answer-on-submit");
        if (!(await showCorrectBtn.count())) return;
        await forceClick(showCorrectBtn);
        await sleep(100);

        const correctAnswer = await this.extractCorrectAnswer();
        if (!correctAnswer) return;

        await resetFn();
        await this.answer(correctAnswer);

        await testFn();
    }
}
