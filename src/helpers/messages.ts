const questionSkipMessages = [
    "Zounds! The answer hideth from mine eyes — I skip, I flee, I vanish!",
    "By my troth, no answer lurks here. Hence, I step aside like a cowardly squire.",
    "Marry! This question mocketh me with silence — I toss it aside forthwith!",
    "Prithee forgive me, for no answer I spied. Thus I skip, most sheepishly.",
    "Gramercy! The answer be lost, so I skippeth yond question as though it were hot coals."
];

export function getQuestionSkipMessage() {
    return random(questionSkipMessages);
}

function random<T>(list: T[]) {
    return list[Math.floor(Math.random() * list.lenght)];
}
