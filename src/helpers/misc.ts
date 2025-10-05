import type { Locator } from "@playwright/test";

export async function click(elem: Locator, timeout = 3000) {
    try {
        await elem.click({ timeout });
        return;
    } catch (err) {
        console.trace(err);
    }

    try {
        await elem.click({ force: true, timeout });
        return;
    } catch (err) {
        console.trace(err);
    }
}

export async function forceClick(elem: Locator, timeout = 3000) {
    try {
        await elem.click({ force: true, timeout });
        return;
    } catch (err) {
        console.trace(err);
    }
}

export async function jsClick(elem: Locator, timeout = 3000) {
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
        console.trace(err);
    }
}

export async function scrollIntoView(elem: Locator, timeout = 3000) {
    try {
        await elem.scrollIntoViewIfNeeded({ timeout });
    } catch (err) {
        console.trace(err);
    }
}
