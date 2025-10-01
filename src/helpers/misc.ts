import type { Locator } from "@playwright/test";

export async function click(elem: Locator, timeout = 5000) {
    try {
        await elem.click({ timeout });
        return;
    } catch {}

    try {
        await elem.click({ force: true, timeout });
        return;
    } catch {}
}

export async function forceClick(elem: Locator, timeout = 5000) {
    try {
        await elem.click({ force: true, timeout });
        return;
    } catch {}
}
