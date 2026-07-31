import { Module } from '@nestjs/common';
import { InternalChatController } from './internal-chat.controller';
import { InternalChatRepository } from './internal-chat.repository';
import { InternalChatService } from './internal-chat.service';

@Module({
  controllers: [InternalChatController],
  providers: [InternalChatRepository, InternalChatService],
  exports: [InternalChatRepository, InternalChatService],
})
export class InternalChatModule {}
