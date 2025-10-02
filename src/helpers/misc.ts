import type { Locator } from "@playwright/test";

export async function click(elem: Locator, timeout = 5000) {
    try {
        await elem.click({ timeout });
        return;
    } catch (err) {
        console.error(err);
    }

    try {
        await elem.click({ force: true, timeout });
        return;
    } catch (err) {
        console.error(err);
    }
}

export async function forceClick(elem: Locator, timeout = 5000) {
    try {
        await elem.click({ force: true, timeout });
        return;
    } catch (err) {
        console.error(err);
    }
}

export async function jsClick(elem: Locator, timeout = 5000) {
    try {
        await elem.evaluate(
            (elem: HTMLElement) => {
                elem.click();
            },
            undefined,
            {
                timeout: timeout,
            },
        );
    } catch (err) {
        console.error(err);
    }
}
