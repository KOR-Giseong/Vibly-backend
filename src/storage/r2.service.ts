import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    this.bucket = config.get<string>('R2_BUCKET_NAME') ?? 'vibly-uploads';
    this.publicUrl = config.get<string>('R2_PUBLIC_URL') ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  /**
   * Buffer를 R2에 업로드하고 공개 URL 반환
   * @param buffer  파일 데이터
   * @param folder  저장할 폴더 (예: 'avatars', 'support-images')
   * @param ext     확장자 (예: 'jpg', 'png', 'webp')
   * @param mimeType  MIME 타입 (예: 'image/jpeg')
   */
  async upload(
    buffer: Buffer,
    folder: string,
    ext: string,
    mimeType: string,
  ): Promise<string> {
    const key = `${folder}/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // 퍼블릭 버킷이므로 ACL 불필요
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  /**
   * 공개 URL로부터 키를 추출해 R2에서 삭제
   * URL 예시: https://pub-xxx.r2.dev/avatars/uuid.jpg
   */
  async deleteByUrl(url: string): Promise<void> {
    try {
      const key = url.replace(`${this.publicUrl}/`, '');
      if (!key || key === url) return; // 다른 출처 URL이면 무시
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      this.logger.warn(`R2 파일 삭제 실패: ${url}`, e);
    }
  }
}
