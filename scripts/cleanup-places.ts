import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 북마크/체크인/리뷰가 하나도 없는 장소 확인
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
