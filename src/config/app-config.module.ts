import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
