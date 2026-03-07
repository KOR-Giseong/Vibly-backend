import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import axios from 'axios';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

if (!KAKAO_KEY) {
  console.error('❌ KAKAO_REST_API_KEY 환경변수가 없습니다.');
  process.exit(1);
}

async function searchKakao(name: string, address: string): Promise<{ lat: number; lng: number } | null> {
  // 주소에서 시/구 추출해서 검색 정확도 향상
  const query = `${name} ${address}`.slice(0, 60);
  try {
    const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      params: { query, size: 1 },
    });
    const doc = res.data?.documents?.[0];
    if (doc?.y && doc?.x) {
      return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
    }
  } catch (e: any) {
    console.warn(`  ⚠️ Kakao 조회 실패: ${e.message}`);
  }
  return null;
}

async function main() {
  // lat=0 또는 lng=0 인 장소 (좌표 미입력 상태)
  const places = await prisma.place.findMany({
    where: { OR: [{ lat: 0 }, { lng: 0 }] },
    select: { id: true, name: true, address: true },
  });

  console.log(`\n좌표 없는 장소: ${places.length}개\n`);

  let fixed = 0;
  let failed = 0;

  for (const place of places) {
    process.stdout.write(`[${fixed + failed + 1}/${places.length}] ${place.name} ... `);
    const coords = await searchKakao(place.name, place.address ?? '');
    if (coords) {
      await prisma.place.update({
        where: { id: place.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      console.log(`✅ (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`);
      fixed++;
    } else {
      console.log(`❌ 조회 실패`);
      failed++;
    }
    // Kakao API 속도 제한 방지
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n완료: ${fixed}개 성공, ${failed}개 실패`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
