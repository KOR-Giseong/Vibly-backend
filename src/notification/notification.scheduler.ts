import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 매일 오후 5시 (KST) 전체 유저에게 일일 알림 발송
   */
  @Cron('0 17 * * *', { timeZone: 'Asia/Seoul' })
  async sendDailyNotification() {
    this.logger.log('일일 자동 알림 발송 시작');
    try {
      const { sent, pushed } = await this.notificationService.broadcastByAdmin(
        '오늘 하루, 어땠나요?',
        '오늘 하루도 수고했어요. 잠깐 쉬어가는 시간, Vibly와 함께요.',
        'NOTICE',
      );
      this.logger.log(`일일 자동 알림 완료: 대상 ${sent}명, push 성공 ${pushed}개`);
    } catch (err) {
      this.logger.error('일일 자동 알림 발송 실패', err);
    }
  }
}
