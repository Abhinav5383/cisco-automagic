import { type Browser, chromium, type Locator, type Page } from "@playwright/test";
import { sleep } from "bun";
import { ActivityHelper } from "./helpers/activity";
import { BotUtilities } from "./helpers/bot-utils";
import { ExamHelper } from "./helpers/exam";
import { doLogin } from "./helpers/login";
import { random } from "./utils";
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
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--start-maximized",
                "--disable-threaded-animation",
                "--disable-animations",
                "--force-prefers-reduced-motion",
            ],
        });
        const page = await browser.newPage();

        const bot = new CiscoBot(page, browser);
        return bot;
    }

    async start() {
        console.log(this.welcomeMessage);

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
        await waitForUserIntervention(
            "Please navigate to the desired module manually and then press 'Enter' here to proceed.",
        );
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

        const sectionDimenstions = await section.boundingBox();
        // Each PageDown scrolls approx 400px
        let downBtnClicks = sectionDimenstions ? Math.ceil(sectionDimenstions.height / 390) : 0;

        while (downBtnClicks-- >= 0) {
            await this.page.keyboard.press("PageDown");
            await sleep(200);
        }

        await this.page.keyboard.press("PageDown");
        await sleep(150);

        await new ActivityHelper(this, section).doActivities();
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

        await this.page.keyboard.press("End");
        await sleep(150);
    }

    private get welcomeMessage() {
        return random([
            "Hark! Thy humble automaton doth awaken, ready for deeds most noble and absurd!",
            "Lo and behold! Thy bot doth stir from slumber, gears squeakin’ like a tipsy lute-player!",
            "Ho there! Thy trusty automaton rises, prepared for tasks both foolish and grand!",
            "Behold! Thy bot awakens, circuits buzzing like a jester at a royal feast!",
            "Greetings! Thy faithful automaton doth arise, ready to embark on quests most whimsical!",
        ]);
    }
}
