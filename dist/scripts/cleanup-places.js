"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const toDelete = await prisma.place.findMany({
        where: {
            bookmarks: { none: {} },
            checkIns: { none: {} },
            reviews: { none: {} },
        },
        select: { id: true, name: true, category: true },
    });
    console.log(`\n삭제 대상: ${toDelete.length}개`);
    toDelete.forEach((p) => console.log(` - [${p.category}] ${p.name}`));
    if (toDelete.length === 0) {
        console.log('정리할 장소가 없습니다.');
        return;
    }
    const ids = toDelete.map((p) => p.id);
    const result = await prisma.place.deleteMany({
        where: { id: { in: ids } },
    });
    console.log(`\n✅ ${result.count}개 장소 삭제 완료`);
    const remaining = await prisma.place.count();
    console.log(`남은 장소: ${remaining}개`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=cleanup-places.js.map