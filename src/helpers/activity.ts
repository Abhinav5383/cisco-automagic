import type { FrameLocator, Locator, Page } from "@playwright/test";
import { sleep } from "bun";
import type { CiscoBot } from "../main";
import type { AnswerObj } from "../types";
import { random } from "../utils";
import type { BotUtilities } from "./bot-utils";
import { ExamHelper } from "./exam";
import { click, forceClick } from "./misc";

const ASSESSMENT_ANSWERS = new Map<string, AnswerObj>();

export class ActivityHelper {
    page: Page;
    section: Locator;
    utils: BotUtilities;

    constructor(parent: CiscoBot, section: Locator) {
        this.page = parent.page;
        this.section = section;
        this.utils = parent.utils;
    }

    get notifyPopupCloseBtn() {
        return this.utils.getModuleFrame().locator(".notify__popup button.notify__close-btn");
    }
    async closeNotifyPopup() {
        await forceClick(this.notifyPopupCloseBtn);
    }

    async doActivities() {
        const ActivityTypes = [
            MultiQuestionAssessment_Activity,
            SingleQuestionSectionQuiz_Activity,
            VideoPlayerActivity,
            ContentLinksActivity,
            AccordionActivity,
            ContentTabsActivity,
            CheckYourAnswerActivity,
        ];

        for (const ActivityType of ActivityTypes) {
            if (await ActivityType.isInside(this.section)) {
                await new ActivityType(this).doActivity();
            }
        }
    }
}

// ? Classes for each activity type

class ActivityBase {
    activityHelper: ActivityHelper;
    section: Locator;

    constructor(parent: ActivityHelper) {
        this.section = parent.section;
        this.activityHelper = parent;
    }
}

class MultiQuestionAssessment_Activity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.getAttribute("class"))?.includes("assessmentsinglesubmit");
    }

    private get assessmentContainer() {
        // .article.assessmentsinglesubmit
        return this.section;
    }
    private get activitySubmitButton() {
        return this.assessmentContainer.locator(
            ".btn__container button.btn__action[aria-label='Submit']",
        );
    }
    private get confirmActivitySubmitCheckbox() {
        return this.assessmentContainer.locator(
            ".btn__container button.submit__anyway-checkbox-container",
        );
    }

    private async submitAssessment() {
        if (await this.assessmentResetButton.count()) {
            return;
        }

        await this.activitySubmitButton.click();
        await sleep(100);

        if (await this.activitySubmitButton.count()) {
            await this.confirmActivitySubmitCheckbox.click();
            await this.activitySubmitButton.click();
        }

        await sleep(100);
        await this.activityHelper.closeNotifyPopup();
    }

    private get assessmentResetButton() {
        return this.assessmentContainer.locator(
            ".btn__container button.btn__action[aria-label='Reset']",
        );
    }
    private async resetAssessment() {
        await this.assessmentResetButton.click();
    }
    private async isAlreadySubmitted() {
        return (await this.assessmentResetButton.count()) > 0;
    }

    private get assessmentQuestions() {
        return this.section.locator("div.block__container div.component.is-question").all();
    }

    private async gatherAnswers() {
        await this.submitAssessment();

        for (const question of await this.assessmentQuestions) {
            const answer = await ExamHelper.extractAnswer(question);
            if (answer) ASSESSMENT_ANSWERS.set(answer.qestionId, answer);
        }

        await sleep(100);
        await this.resetAssessment();
    }

    private async doQuestions() {
        for (const question of await this.assessmentQuestions) {
            const questionId = await ExamHelper.getUniqueQuestionId(question);
            if (!questionId) return;

            const answer = ASSESSMENT_ANSWERS.get(questionId);
            if (!answer) return;

            await ExamHelper.answerQuestion(question, answer);
            await sleep(100);
        }

        await this.submitAssessment();
    }

    private async doAssessment() {
        await this.gatherAnswers();
        await this.doQuestions();
    }

    async doActivity() {
        if (await this.isAlreadySubmitted()) {
            await this.resetAssessment();
        }

        console.log(this.startMsg);
        await this.doAssessment();
        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Lo! We embark upon the assessment adventure...",
            "By my troth! The trials of questions we now face...",
            "Hark! Time to wrestle with riddles and scrolls most fiendish...",
            "Onward, to the realm of questions and answers we go...",
        ]);
    }

    private get completedMsg() {
        return random([
            "Huzzah! Assessment completed, forsooth...",
            "Marry! The questions hath been conquered!",
            "Gramercy! The final answer hath been delivered unto the realm...",
        ]);
    }
}

class VideoPlayerActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.locator("div.brightcove__inner iframe").count()) > 0;
    }

    get videoIFrames() {
        return this.section.locator("div.brightcove__inner iframe");
    }

    private async watchVideo(frame: FrameLocator) {
        const playBtn = frame.locator("button.vjs-big-play-button");
        await playBtn.click();

        await sleep(1000);

        const progressBar = frame.locator("div.vjs-progress-holder.vjs-slider");
        const progressBarDimenstions = await progressBar.boundingBox();
        if (!progressBarDimenstions) return;

        // Click at 99% of the progress bar to complete the video
        await progressBar.click({
            position: {
                x: progressBarDimenstions.width - 2,
                y: progressBarDimenstions.height / 2,
            },
        });
        await sleep(1000);

        if (await frame.locator(".vjs-paused video").count()) {
            await click(playBtn);
        }

        await frame
            .locator(".vjs-ended video")
            .first()
            .waitFor({ timeout: 60_000 })
            .catch(() => {});
    }

    async doActivity() {
        console.log(this.startMsg);

        for (const videoContainer of await this.videoIFrames.all()) {
            if (await videoContainer.isHidden()) continue;
            await this.watchVideo(videoContainer.contentFrame());
        }

        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Hark! Time to watch moving pictures and pretend we understand them...",
            "Lo! Let us feast our eyes upon the magic of the screen!",
            "By my troth, the cinema awaits! Watch we must...",
        ]);
    }

    private get completedMsg() {
        return random([
            "The moving pictures hath ended, mine eyes are weary!",
            "Gramercy! The video playeth no more!",
            "Zounds! All scenes have been viewed and the tale concludes...",
        ]);
    }
}

class ContentLinksActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.locator("div.content-links-widget").count()) > 0;
    }

    private get contentLinks() {
        return this.section.locator("div.content-links-widget");
    }

    private async clickContentLink(widget: Locator) {
        if (await widget.isHidden()) return;

        const mainBtn = widget.locator("button.open-dialog.btn__action");
        if (await mainBtn.count()) {
            await click(mainBtn);
        } else {
            const alt = widget.locator("a.btn__action");
            await alt.evaluate((alt: HTMLAnchorElement) => {
                alt.href = "#";
                alt.addEventListener("click", (e) => {
                    e.stopImmediatePropagation();
                });
            });
        }

        await sleep(200);
    }

    async doActivity() {
        console.log(this.startMsg);

        for (const widget of await this.contentLinks.all()) {
            try {
                await this.clickContentLink(widget);
            } catch (error) {
                console.error(error);
            }
        }

        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Clicketh we now upon these mystical content links...",
            "Zounds! Let us explore links as knights seek treasure!",
            "By my troth, these hyperlinks shall yield their secrets...",
            "Hark! The path of knowledge lies within these links...",
            "Onward, to click and discover we go...",
            "Lo! The adventure of link-clicking awaits...",
        ]);
    }

    private get completedMsg() {
        return random([
            "All links have been clicked (or ignored most nobly)!",
            "Huzzah! The links hath been conquered!",
            "Marry! No hyperlink doth remain unturned...",
            "Gramercy! The final link hath been clicked unto the realm...",
            "The hyperlinks hath yielded their secrets, forsooth...",
            "The quest of link-clicking is complete, mine friends...",
        ]);
    }
}

class AccordionActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (
            (await section.locator("div.component.accordion button.accordion__item-btn").count()) >
            0
        );
    }

    private get accordions() {
        return this.section.locator("div.component.accordion button.accordion__item-btn").all();
    }

    async doActivity() {
        console.log(this.startMsg);

        for (const acc of await this.accordions) {
            await acc.click();
            await sleep(100);
        }
        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Lo! Accordion sections we shall unfold...",
            "By my troth! Let us reveal the secrets of the accordions...",
            "Hark! Each fold doth hide a tale untold...",
            "Onward, to the realm of hidden knowledge we go...",
        ]);
    }

    private get completedMsg() {
        return random([
            "All accordion sections revealed, secrets laid bare!",
            "Zounds! The accordions yield their hidden wisdom!",
            "Marry! The folds hath been conquered with gentle clicks...",
            "The accordions hath sung their secrets, forsooth...",
            "The quest of unfolding accordions is complete, mine friends...",
        ]);
    }
}

class ContentTabsActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.locator("div.component__widget.tab__widget").count()) > 0;
    }

    private getTabWidgets() {
        return this.section.locator("div.component__widget.tab__widget").all();
    }
    private getTabButtons(widget: Locator) {
        return widget.locator("button.tabs__nav-item-btn").all();
    }

    private async visitTabSections(widget: Locator) {
        const tabButtons = await this.getTabButtons(widget);

        for (const tabBtn of tabButtons) {
            await tabBtn.click();
            await sleep(40);
        }
    }

    async doActivity() {
        console.log(this.startMsg);

        for (const widget of await this.getTabWidgets()) {
            await this.visitTabSections(widget);
        }

        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Now, on to the tabbed realms we voyage...",
            "Zounds! Each tab a new adventure awaits!",
            "By my troth, click we through these tabbed mysteries...",
            "Lo! The tabbed journey begins...",
        ]);
    }

    private get completedMsg() {
        return random([
            "All tabs visited, mysteries unraveled!",
            "Huzzah! No tab remains unexplored!",
            "Gramercy! The tabbed domains hath been conquered...",
            "The quest of tab-clicking is complete, mine friends...",
        ]);
    }
}

class CheckYourAnswerActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.locator(".component__widget button").getByText("Check").count()) > 0;
    }

    private get buttonContainers() {
        return this.section.locator(".component__widget").all();
    }
    private getCheckAnswerBtn(container: Locator) {
        return container.locator("button").getByText("Check");
    }
    private getShowMeButton(container: Locator) {
        return container.locator("button").getByText("Show Me");
    }

    private async checkAnswer(container: Locator) {
        const showMeBtn = this.getShowMeButton(container);
        if ((await showMeBtn.count()) > 0) {
            await click(showMeBtn);
        }

        const checkAnswerBtn = this.getCheckAnswerBtn(container);
        if (!(await checkAnswerBtn.count())) return;

        await click(checkAnswerBtn);

        if (await this.activityHelper.notifyPopupCloseBtn.count()) {
            try {
                await this.activityHelper.closeNotifyPopup();
            } catch {}
        }
    }

    async doActivity() {
        console.log(this.startMsg);

        for (const container of await this.buttonContainers) {
            await this.checkAnswer(container);
            await sleep(50);
        }

        console.log(this.completedMsg);
    }

    private get startMsg() {
        return random([
            "Hark! 'Tis time to check thine answers...",
            "By my troth, we shall see if wisdom prevails!",
            "Lo! Let the answers be revealed unto thee...",
            "Marry! Let us unveil the correctness of our answers...",
        ]);
    }

    private get completedMsg() {
        return random([
            "All answers revealed, truth (or nonsense) laid bare for all!",
            "Marry! The wisdom of the realm hath spoken through these answers!",
            "Zounds! Each question hath confessed, leaving naught but enlightenment!",
        ]);
    }
}

class SingleQuestionSectionQuiz_Activity extends ActivityBase {
    static async isInside(section: Locator) {
        const questionBox = section.locator(".component.is-question");
        const hasQuestions = (await questionBox.count()) > 0;
        const hasSubmitBtn = await questionBox
            .locator(".btn__container button")
            .getByText("submit")
            .count();

        return hasQuestions && hasSubmitBtn;
    }

    private get questions() {
        return this.section.locator(".component.is-question").all();
    }
    private getSubmitButton(question: Locator) {
        return question.locator(".btn__container button").getByText("submit");
    }
    private getResetButton(question: Locator) {
        return question.locator(".btn__container button").getByText("reset");
    }

    static async isCorrect(question: Locator) {
        return (await question.locator("div.component__widget.is-complete").count()) > 0;
    }

    private async answerQuestion(question: Locator) {
        // just in case
        if (await this.getResetButton(question).count()) {
            await forceClick(this.getResetButton(question));
        }

        const testFn = async () => {
            await forceClick(this.getSubmitButton(question));
            await this.activityHelper.closeNotifyPopup();
            await forceClick(this.getResetButton(question));

            return await SingleQuestionSectionQuiz_Activity.isCorrect(question);
        };

        const questionHelper = await ExamHelper.constructQuestionHelper(question);
        if (!questionHelper) return;

        await questionHelper.guessAnswer(testFn);
    }

    async doActivity() {
        console.log("Doing Single Question Section Quiz...");

        for (const question of await this.questions) {
            if (await SingleQuestionSectionQuiz_Activity.isCorrect(question)) {
                continue;
            }
            await this.answerQuestion(question);
            await sleep(100);
        }

        console.log("Completed Single Question Section Quiz.");
    }
}
