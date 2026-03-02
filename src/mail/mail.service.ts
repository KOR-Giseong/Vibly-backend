import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,          // Render는 465(SSL) 차단 → 587(STARTTLS) 사용
      secure: false,       // STARTTLS
      family: 4,           // IPv4 강제 (Render IPv6 미지원)
      pool: true,
      maxConnections: 3,
      auth: {
        user: this.config.get<string>('GMAIL_USER'),
        pass: this.config.get<string>('GMAIL_APP_PASSWORD'),
      },
    } as any);

  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const from = this.config.get<string>('GMAIL_USER');
    try {
      await this.transporter.sendMail({
        from: `Vibly <${from}>`,
        to,
        subject: '[Vibly] 이메일 인증 코드',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h2 style="font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">
              이메일 인증
            </h2>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
              아래 6자리 인증 코드를 앱에 입력해 주세요.<br/>
              코드는 <strong>10분</strong> 후에 만료됩니다.
            </p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #7c3aed;">
                ${code}
              </span>
            </div>
            <p style="color: #999; font-size: 13px;">
              본인이 요청하지 않은 경우 이 메일을 무시해 주세요.
            </p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error('이메일 발송 실패', err);
    }
  }
}

