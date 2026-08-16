import { beforeAll, afterAll } from "@jest/globals";
import { prisma } from "../src/config/prisma.js";
import { redis } from "../src/config/redis.js";
beforeAll(async () => {
    process.env.NODE_ENV = "test";
    try {
        await prisma.profile.deleteMany();
        await prisma.user.deleteMany();
    }
    catch {
        // Ignore if not connected
    }
});
afterAll(async () => {
    try {
        await prisma.profile.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
    }
    catch {
        // Ignore
    }
    try {
        const keys = await redis.keys("*");
        if (keys.length > 0) {
            await redis.del(...keys);
        }
        await redis.quit();
    }
    catch {
        // Ignore
    }
});
//# sourceMappingURL=setup.js.map