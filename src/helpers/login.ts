import type { Page } from "@playwright/test";
import { sleep } from "bun";

export async function doLogin(page: Page, username: string, password: string) {
    await page.goto("https://www.netacad.com/dashboard");
    await sleep(2000);
    const loginBtn = page.getByRole("button").filter({ hasText: "Login" });
    await loginBtn.waitFor({
        state: "visible",
    });

    // Fill username and password
    await page.locator("input#username").fill(username);
    const submitBtn = page.locator("input#kc-login[type='submit']");
    await submitBtn.click();

    await page.locator("input#password").fill(password);
    await submitBtn.click();

    // Wait for either success or failure
    while (true) {
        console.log("Waiting for login to complete...");
        await sleep(200);

        if (await page.locator("[role='alert'] .alert__message").isVisible()) {
            throw new Error("Login Failed! Invalid Credentials");
        }

        if (page.url().includes("www.netacad.com/dashboard")) {
            console.log("Login Successful!");
            return;
        }
    }
}
