const envKeys = ["USERNAME", "PASSWORD", "COURSE_NAME", "COURSE_URL"] as const;

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
