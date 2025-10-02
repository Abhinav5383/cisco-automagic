export function random<T>(list: T[]) {
    return list[Math.floor(Math.random() * list.length)] as T;
}

export function* combinations<T>(k: number, arr: T[]): Generator<T[]> {
    if (k > arr.length || k <= 0) return;
    if (k === arr.length) {
        yield [...arr];
        return;
    }
    if (k === 1) {
        for (const item of arr) {
            yield [item];
        }
        return;
    }

    // Include first element in combinations
    for (const subset of combinations(k - 1, arr.slice(1))) {
        yield [arr[0] as T, ...subset];
    }

    // Exclude first element from combinations
    yield* combinations(k, arr.slice(1));
}
