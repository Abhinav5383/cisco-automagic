import { type Browser, chromium, type Locator, type Page } from "@playwright/test";
import { sleep } from "bun";
import { BotUtilities } from "./helpers/bot-utils";
import { ExamHelper } from "./helpers/exam";
import { doLogin } from "./helpers/login";
import env from "./utils/env";
import { waitForUserIntervention } from "./utils/prompt";

async function main() {
    const bot = await CiscoBot.create();
    await bot.start();
}
await main();

export class CiscoBot {
    page: Page;
    utils: BotUtilities;
    private browser: Browser;

    constructor(page: Page, browser: Browser) {
        this.page = page;
        this.browser = browser;
        this.utils = new BotUtilities(page);
    }

    static async create() {
        const browser = await chromium.launch({
            executablePath: "/usr/bin/chromium",
            headless: false,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
        });
        const page = await browser.newPage();

        const bot = new CiscoBot(page, browser);
        return bot;
    }

    async start() {
        await doLogin(this.page, env.USERNAME, env.PASSWORD);
        await this.navigateToChosenCourse();

        let continueLoop = true;
        let iterCount = 0;

        while (continueLoop) {
            iterCount++;
            console.log("\nModule count:", iterCount);

            await this.startScrollingModules();
            continueLoop = await this.utils.goToNextSubModule();
        }

        console.log("All modules completed!");
        await waitForUserIntervention("Press 'Enter' to exit.");
        await this.cleanup();
    }

    private async cleanup() {
        await this.page.close();
        await this.browser.close();
    }

    private async navigateToChosenCourse() {
        const page = this.page;

        if (!env.COURSE_URL && !env.COURSE_NAME) {
            throw new Error(
                "Either COURSE_URL or COURSE_NAME must be provided in the environment variables.",
            );
        }

        // Goto course page
        if (env.COURSE_URL) {
            await page.goto(env.COURSE_URL);
        }
        // Click on the course card link
        else if (env.COURSE_NAME) {
            if (!page.url().includes("www.netacad.com/dashboard")) {
                await page.goto("https://www.netacad.com/dashboard");
            }

            const courseLink = page
                .locator(`button[aria-label='${env.COURSE_NAME}']`)
                .or(page.locator(`button[aria-label='Resume ${env.COURSE_NAME}']`));

            await courseLink.click();
            await page.waitForLoadState("load");
        }

        await waitForUserIntervention(
            "Please navigate to the desired module manually and then press 'Enter' here to proceed.",
        );
    }

    private async startScrollingModules() {
        const sections: Locator[] = [];

        for (const section of await this.utils.getSections().all()) {
            if (!(await this.utils.getSectionHeaderText(section))) continue;
            sections.push(section);
        }

        let focusedInside = false;

        for (const section of sections) {
            try {
                if (!focusedInside) {
                    await section.click();
                    focusedInside = true;
                }

                await this.completeSection(section);
            } catch (err) {
                console.error("Error completing section activities:", err);
            }
        }
    }

    private async completeSection(section: Locator) {
        if (await ExamHelper.isExamSection(section)) {
            const examDoer = new ExamHelper(this, section);
            await examDoer.doExam();
            return;
        }

        const heading = this.utils.getSectionHeader(section).first();
        if (await this.utils.isSectionCompleted(section)) {
            return 0;
        }

        await heading.scrollIntoViewIfNeeded();
        // await completeActivities(section, page);

        const sectionDimenstions = await section.boundingBox();
        // Each PageDown scrolls approx 400px
        let downBtnClicks = sectionDimenstions ? Math.ceil(sectionDimenstions.height / 410) : 0;

        while (downBtnClicks-- > 0) {
            await this.page.keyboard.press("PageDown");
            await sleep(180);
        }

        await this.page.keyboard.press("PageDown");
        await sleep(150);
    }
}
