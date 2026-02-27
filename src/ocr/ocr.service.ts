import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly client: ImageAnnotatorClient;

  constructor(private readonly config: ConfigService) {
    const projectId = config.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    const clientEmail = config.get<string>('GOOGLE_CLOUD_CLIENT_EMAIL');
    const privateKey = config
      .get<string>('GOOGLE_CLOUD_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Google Cloud Vision 환경변수가 설정되지 않았습니다. OCR 기능이 비활성화됩니다.',
      );
    }

    this.client = new ImageAnnotatorClient({
      credentials: { client_email: clientEmail, private_key: privateKey },
      projectId,
    });
  }

  /**
   * 이미지 버퍼에서 텍스트 라인 배열을 추출합니다.
   * - 반환값: OCR로 인식된 텍스트 라인 목록 (빈 줄 제거됨)
   */
  async extractLines(imageBuffer: Buffer): Promise<string[]> {
    const [result] = await this.client.textDetection({
      image: { content: imageBuffer.toString('base64') },
    });

    const annotations = result.textAnnotations ?? [];
    if (!annotations.length) return [];

    // 첫 번째 annotation이 전체 텍스트 (나머지는 단어 단위)
    const fullText = annotations[0].description ?? '';
    return fullText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }
}
