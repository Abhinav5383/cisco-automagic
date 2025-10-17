export async function waitForUserIntervention(message: string) {
    console.log(message);
    prompt("Press Enter to continue...");
}
