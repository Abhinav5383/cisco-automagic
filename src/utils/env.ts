const envKeys = ["USERNAME", "PASSWORD", "COURSE_BTN_ID"] as const;

type EnvKeys = (typeof envKeys)[number];
const env = {} as Record<EnvKeys, string>;

for (const key of envKeys) {
    const value = process.env[key];
    if (value === undefined) {
        console.error(`Missing environment variable: ${key}`);
        process.exit(1);
    }

    env[key] = value;
}

export default env;
