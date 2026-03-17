import type { Locator, Page } from "@playwright/test";
import { sleep } from "bun";
import { forceClick } from "./misc";

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
            .or(section.locator(".component__widget .module-title"))
            .first();

        return header;
    }

    async getSectionHeaderText(section: Locator) {
        const header = this.getSectionHeader(section);
        if (!(await header.count())) return null;

        const text = await header.textContent();
        if (!text) return null;

        return text.trim();
    }

    isSectionCompleted(sectionHeader: string) {
        if (!sectionHeader?.trim() || sectionHeader.toLowerCase().startsWith("complete")) {
            return true;
        } else {
            return false;
        }
    }

    async getFirstNonEmptyHeaderText() {
        const sections = await this.getSections().all();
        for (const section of sections) {
            const headerText = await this.getSectionHeaderText(section);
            if (headerText?.trim()) return headerText;
        }

        return null;
    }

    private async waitForOptionalLoaderToDisappear(
        locator: Locator,
        timeout: number,
        appearTimeout = 750,
    ) {
        try {
            await locator.waitFor({ state: "visible", timeout: appearTimeout });
        } catch {
            return false;
        }

        try {
            await locator.waitFor({ state: "hidden", timeout });
        } catch {
            return false;
        }

        return true;
    }

    async waitForNextBtnToBeEnabled() {
        let tries = 100;
        while (tries--) {
            if (!(await this.nextBtn.count())) return;
            if ((await this.nextBtn.getAttribute("disabled")) === null) return;
            await sleep(300);
        }

        return;
    }

    private async waitForPreloaderToDisappear() {
        const preloader = this.page.locator("div.loader .wheel");
        return this.waitForOptionalLoaderToDisappear(preloader, 30_000);
    }

    private async waitForModuleFrameToLoad() {
        const iframeLoader = this.getModuleFrame()
            .locator("div.loading__image-before-loader")
            .last();

        return this.waitForOptionalLoaderToDisappear(iframeLoader, 30_000);
    }

    private async waitForCourseContentToLoad() {
        await this.page.waitForLoadState("load");
        const courseProgressLoadingIndicator = this.getModuleFrame().locator(".loading__content");

        return this.waitForOptionalLoaderToDisappear(courseProgressLoadingIndicator, 60_000);
    }

    async waitForLoadersToDisappear(retry = 3) {
        const preloaderAppeared = await this.waitForPreloaderToDisappear();

        // Sometimes the preloader disappears but the frame doesn't start loading
        // one hint for something like that is the next button being disabled
        await this.waitForNextBtnToBeEnabled();
        const iframeLoaderAppeared = await this.waitForModuleFrameToLoad();
        const courseContentLoaderAppeared = await this.waitForCourseContentToLoad();

        if (
            preloaderAppeared &&
            !iframeLoaderAppeared &&
            !courseContentLoaderAppeared &&
            retry > 0
        ) {
            await this.waitForLoadersToDisappear(retry - 1);
            return;
        }
    }

    async goToNextSubModule(retry = true): Promise<boolean> {
        const prevPageMark = await this.getFirstNonEmptyHeaderText();

        await this.waitForNextBtnToBeEnabled();
        if (!(await this.nextBtn.count())) return false;
        if ((await this.nextBtn.getAttribute("disabled")) !== null) return false;

        await forceClick(this.nextBtn);
        await this.waitForLoadersToDisappear();

        const newPageMark = await this.getFirstNonEmptyHeaderText();
        if (retry && (prevPageMark || newPageMark) && prevPageMark === newPageMark) {
            let tries = 30;
            while (tries-- > 0) {
                await sleep(300);
                const newPageMark = await this.getFirstNonEmptyHeaderText();
                if ((prevPageMark || newPageMark) && prevPageMark !== newPageMark) return true;
            }

            return await this.goToNextSubModule(false);
        }

        return true;
    }
}
