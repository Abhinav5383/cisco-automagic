import type { FrameLocator, Locator, Page } from "@playwright/test";
import { sleep } from "bun";
import type { CiscoBot } from "../main";
import type { AnswerObj } from "../types";
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
        const ActivitiTypes = [
            SingleAssessmentActivity,
            VideoPlayerActivity,
            ContentLinksActivity,
            AccordionActivity,
            ContentTabsActivity,
            CheckYourAnswerActivity,
        ];

        for (const ActivityType of ActivitiTypes) {
            if (await ActivityType.isInside(this.section)) {
                await new ActivityType(this).doActivity();
            }
        }
    }
}

class ActivityBase {
    activityHelper: ActivityHelper;
    section: Locator;

    constructor(parent: ActivityHelper) {
        this.section = parent.section;
        this.activityHelper = parent;
    }
}

class SingleAssessmentActivity extends ActivityBase {
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

        console.log("Doing assessment activity...");
        await this.doAssessment();
        console.log("Assessment activity complete...");
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
        console.log("Doing video activity...");

        for (const videoContainer of await this.videoIFrames.all()) {
            if (await videoContainer.isHidden()) continue;
            await this.watchVideo(videoContainer.contentFrame());
        }

        console.log("Video activity complete...");
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
        console.log("Doing content links activity...");

        for (const widget of await this.contentLinks.all()) {
            try {
                await this.clickContentLink(widget);
            } catch (error) {
                console.error(error);
            }
        }

        console.log("Content links activity complete...");
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
        console.log("Doing accordion activity...");
        for (const acc of await this.accordions) {
            await acc.click();
            await sleep(100);
        }
        console.log("Accordion activity complete...");
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
        console.log("Doing content tabs activity...");

        for (const widget of await this.getTabWidgets()) {
            await this.visitTabSections(widget);
        }
        console.log("Content tabs activity complete...");
    }
}

class CheckYourAnswerActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (
            (await section
                .locator(".component__widget .btn__container button")
                .getByText("Check")
                .count()) > 0
        );
    }

    private get buttonContainers() {
        return this.section.locator(".component__widget .btn__container:has(button)").all();
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
        await click(checkAnswerBtn);

        if (await this.activityHelper.notifyPopupCloseBtn.count()) {
            try {
                await this.activityHelper.closeNotifyPopup();
            } catch {}
        }
    }

    async doActivity() {
        console.log("Doing 'Check Your Answer' activity...");

        for (const container of await this.buttonContainers) {
            await this.checkAnswer(container);
            await sleep(50);
        }

        console.log("'Check Your Answer' activity complete...");
    }
}
