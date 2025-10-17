import type { Locator } from "@playwright/test";

export async function click(elem: Locator, timeout = 3000) {
    try {
        await elem.click({ timeout });
        return true;
    } catch (err) {
        console.trace(err);
    }

    try {
        await elem.click({ force: true, timeout });
        return true;
    } catch (err) {
        console.trace(err);
    }

    return false;
}

export async function forceClick(elem: Locator, timeout = 3000) {
    try {
        await elem.click({ force: true, timeout });
        return true;
    } catch (err) {
        console.trace(err);
    }

    return false;
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
        return true;
    } catch (err) {
        console.trace(err);
    }

    return false;
}

export async function scrollIntoView(elem: Locator, timeout = 3000) {
    try {
        await elem.scrollIntoViewIfNeeded({ timeout });
        return true;
    } catch (err) {
        console.trace(err);
    }

    return false;
}

export async function waitUntilClickable(elem: Locator, timeout = 3000) {
    try {
        await elem.waitFor({ state: "visible", timeout });
        await elem.isEnabled({ timeout });

        return true;
    } catch (err) {
        console.trace(err);
    }

    return false;
}
