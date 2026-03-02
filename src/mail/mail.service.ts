import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    // Gmail SMTP (현재 사용)
    // 도메인 구매 후 Resend로 전환 시: from 주소를 noreply@vibly.app 으로 바꾸고
    // nodemailer 대신 resend.emails.send() 호출로 교체하면 됨
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.config.get<string>('GMAIL_USER'),
        pass: this.config.get<string>('GMAIL_APP_PASSWORD'), // 앱 비밀번호 (16자리)
      },
    });
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

