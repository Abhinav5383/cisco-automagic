import type { Page } from "@playwright/test";
import { sleep } from "bun";

export async function doLogin(page: Page, username: string, password: string, isRetry = false) {
    await page.goto("https://www.netacad.com/dashboard");
    await sleep(2000);
    await page.waitForLoadState("load");
    await sleep(2000);
    await page.waitForLoadState("load");

    const usernameInput = page.locator("input#username");
    if (!(await usernameInput.count()) && page.url().includes("www.netacad.com/dashboard")) {
        console.log("Already logged in.");
        return;
    }

    const loginBtn = page.getByRole("button").filter({ hasText: "Login" });
    await loginBtn.waitFor({ state: "visible", timeout: 15_000 });

    // Fill username and password
    await usernameInput.fill(username);
    const submitBtn = page.locator("input#kc-login[type='submit']");
    await submitBtn.click();

    await page.locator("input#password").fill(password);
    await submitBtn.click();

    let loginWaitIters = 600;
    while (loginWaitIters-- > 0) {
        console.log("Waiting for login to complete...");
        await sleep(200);

        if (await page.locator("[role='alert'] .alert__message").isVisible()) {
            if (!isRetry) {
                console.log("Login Failed! Retrying...");
                return await doLogin(page, username, password, true);
            } else {
                throw new Error("Login Failed! Invalid Credentials");
            }
        }

        if (page.url().includes("www.netacad.com/dashboard")) {
            console.log("Login Successful!");
            return;
        }
    }

    if (!isRetry) {
        console.log("Login timed out! Retrying...");
        return await doLogin(page, username, password, true);
    }

    throw new Error("Login failed");
}
