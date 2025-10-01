import { $ } from "bun";

export async function waitForUserIntervention(message: string) {
    console.log(message);
    await playAttentionNotifier();
    prompt("Press Enter to continue...");
}

async function playAttentionNotifier() {
    await $`paplay ./assets/buzzer.mp3`;
    await $`paplay ./assets/buzzer.mp3`;
}
