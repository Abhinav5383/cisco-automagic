import type { Locator } from "@playwright/test";
import { sleep } from "bun";
import { jsClick, scrollIntoView } from "~/helpers/misc";
import { ActivityBase } from "./base";

export class SentenceSequenceActivity extends ActivityBase {
    static async isInside(section: Locator) {
        return (await section.locator("div.component.stacker").count()) > 0;
    }

    private get sequenceWidget() {
        return this.section.locator("div.component.stacker");
    }

    private get sequenceItems() {
        return this.sequenceWidget.locator("ul li.sentenceSequence").all();
    }

    private get resetBtn() {
        return this.sequenceWidget.locator("buttons-view button[aria-label*='reset']");
    }

    private get submitBtn() {
        return this.sequenceWidget.locator("buttons-view button[aria-label*='submit']");
    }

    private get showAnswerBtn() {
        return this.sequenceWidget.locator("buttons-view button.show-answer-on-submit");
    }

    private async getItemId(item: Locator) {
        return await item.getAttribute("data-itemid");
    }

    private async updatePosition(item: Locator, position: number) {
        const changePosBtn = item.locator(".stacker__item-state button");
        await jsClick(changePosBtn);
        await sleep(100);

        const dropDownStrip = item.locator(".stacker__item-state .dropdownstrip");
        const targetOption = dropDownStrip.locator(`button[data-target='${position}']`);

        await jsClick(targetOption);
    }

    private async solveSequence(answers: Map<number, string>) {
        const items = await this.sequenceItems;
        console.log("CorrectSequence", answers);

        for (let i = items.length; i > 0; i--) {
            const targetItem = answers.get(i);
            const item = this.sequenceWidget.locator(
                `ul li.sentenceSequence[data-itemid='${targetItem}']`,
            );
            console.log(`${targetItem} -> ${i}`);

            await this.updatePosition(item, i);
            await sleep(2500);
        }

        await jsClick(this.submitBtn);
        await sleep(100);
    }

    private async getCorrectPositions() {
        await jsClick(this.submitBtn);
        await sleep(100);
        await jsClick(this.showAnswerBtn);
        await sleep(100);

        // data-itemid -> position (range: [1, itemsLen])
        const correctPositions = new Map<number, string>();
        const items = await this.sequenceItems;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            const itemId = await this.getItemId(item);
            if (!itemId) continue;

            correctPositions.set(i + 1, itemId);
        }

        await jsClick(this.resetBtn);
        return correctPositions;
    }

    async doActivity() {
        console.log("Doing Sentence Ordering Activity...");
        await scrollIntoView(this.sequenceWidget);

        if (await this.resetBtn.count()) {
            console.log("Already ordered!");
        }

        const answers = await this.getCorrectPositions();
        await this.solveSequence(answers);

        console.log("Completed Sentence Ordering Activity.");
    }
}
