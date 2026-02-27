import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { ReceiptMatcherService } from './receipt-matcher.service';

@Module({
  providers: [OcrService, ReceiptMatcherService],
  exports: [OcrService, ReceiptMatcherService],
})
export class OcrModule {}
