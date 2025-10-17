import { type Browser, chromium, type Locator, type Page } from "@playwright/test";
import { sleep } from "bun";
import { ActivityHelper } from "./helpers/activity";
import { BotUtilities } from "./helpers/bot-utils";
import { ExamHelper } from "./helpers/exam";
import { doLogin } from "./helpers/login";
import { click } from "./helpers/misc";
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
                "--use-gl=egl",
                "--enable-gpu-rasterization",
                "--enable-features=UseOzonePlatform",
                "--ozone-platform=wayland",
                "--ozone-platform-hint=auto",
                "--gtk-version=4",
                "--enable-features=VaapiVideoDecoder,VaapiIgnoreDriverChecks,Vulkan,DefaultANGLEVulkan,VulkanFromANGLE",
                "--password-store=gnome-libsecret",
                "--disable-dev-shm-usage",
            ],
        });
        const page = await browser.newPage();

        const bot = new CiscoBot(page, browser);
        return bot;
    }

    async start() {
        console.log(this.welcomeMessage);

        await doLogin(this.page, env.USERNAME, env.PASSWORD);
        await sleep(3000);
        await this.page.waitForLoadState("domcontentloaded");
        await this.navigateToChosenCourse();

        let continueLoop = true;
        let iterCount = 0;

        while (continueLoop) {
            iterCount++;
            console.log("\nModule count:", iterCount);

            await this.startScrollingModules();
            await this.page.keyboard.press("End");
            await sleep(200);
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
        const courseLink = this.page.locator(`button#${env.COURSE_BTN_ID}`);

        if (await click(courseLink, 30_000)) {
            console.log("Navigating to the course...");
            await sleep(30_000);
            await this.utils.waitForLoadersToDisappear();
        } else {
            console.log("Could not find the course link automatically.");
            await waitForUserIntervention(
                "Please navigate to the desired course manually and then press 'Enter' here to proceed.",
            );
        }
    }

    private async completeSection(section: Locator) {
        if (await ExamHelper.isExamSection(section)) {
            const examDoer = new ExamHelper(this, section);
            await examDoer.doExam();
            return;
        }

        const heading = this.utils.getSectionHeader(section).first();
        await heading.scrollIntoViewIfNeeded();

        let prevYPos = -1;
        let remainingAttempts = 300;
        while (remainingAttempts > 0) {
            const sectionRect = await section.boundingBox();

            if (!sectionRect || sectionRect.y === prevYPos) break;
            // stop if we've scrolled past the section
            if (sectionRect.y < -sectionRect.height) break;

            remainingAttempts--;
            prevYPos = sectionRect.y;

            await this.page.mouse.wheel(0, 200);
            await sleep(100);
        }

        await this.page.keyboard.press("PageDown");
        await sleep(200);

        await new ActivityHelper(this, section).doActivities();
    }

    private async startScrollingModules() {
        const incompleteSections: Locator[] = [];

        for (const section of await this.utils.getSections().all()) {
            if (await this.utils.isSectionCompleted(section)) continue;
            const headerText = await this.utils.getSectionHeaderText(section);
            // skip the first section as it doesn't need to be completed
            // the first section is always numbered like X.Y
            if (!headerText || /^\d+\.\d+\s/.test(headerText.trim())) continue;

            incompleteSections.push(section);
        }

        let focusedInside = false;

        for (const section of incompleteSections) {
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
