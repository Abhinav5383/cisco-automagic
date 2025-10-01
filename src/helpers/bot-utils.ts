import type { Locator, Page } from "@playwright/test";
import { sleep } from "bun";
import { click } from "./misc";

export class BotUtilities {
    page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    getModuleFrame() {
        return this.page.frameLocator("iframe[aria-label='Course content']");
    }

    getSections() {
        return this.getModuleFrame().locator(".article__container div.article");
    }

    get nextBtn() {
        return this.page.locator("div.fullscreen button:has(.icon-right-arrow)");
    }

    getSectionHeader(section: Locator) {
        const header = section
            .locator(".component__header .component__content h1")
            .or(section.locator(".article__header .article__title-inner"))
            .or(section.locator(".component__widget .module-title"));

        return header;
    }

    async getSectionHeaderText(section: Locator) {
        const header = this.getSectionHeader(section);
        if (!(await header.count())) return null;

        const text = await header.textContent();
        if (!text) return null;

        return text.trim();
    }

    async isSectionCompleted(section: Locator) {
        const headerText = await this.getSectionHeaderText(section);
        console.log(headerText);

        if (!headerText?.trim() || headerText.toLowerCase().startsWith("complete")) {
            return true;
        } else {
            return false;
        }
    }

    async waitForNextBtnToBeEnabled() {
        await sleep(500);

        let tries = 100;
        while (tries--) {
            await sleep(300);
            if ((await this.nextBtn.getAttribute("disabled")) === null) return;
            if (!(await this.nextBtn.count())) return;
        }

        return;
    }

    async goToNextSubModule() {
        await this.waitForModuleProgressToLoad();
        if ((await this.nextBtn.getAttribute("disabled")) !== null) return false;

        await click(this.nextBtn);
        await this.waitForNextBtnToBeEnabled();

        await sleep(500);
        return true;
    }

    async waitForModuleProgressToLoad() {
        await this.waitForNextBtnToBeEnabled();

        const progressBox = this.getModuleFrame().getByText("Checking for course progress..");
        if ((await progressBox.count()) || (await progressBox.isVisible())) {
            await progressBox.waitFor({ state: "hidden", timeout: 30_000 });
        }
    }
}
