import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { CreateThreadDto } from './dto/create-thread.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { InternalChatRepository } from './internal-chat.repository';

@Injectable()
export class InternalChatService {
  constructor(private readonly repository: InternalChatRepository) {}

  listThreads(user: AuthUser) {
    return this.repository.listThreads(user);
  }

  async findThread(user: AuthUser, threadId: string) {
    const thread = await this.repository.findThread(user, threadId);
    if (!thread) throw new NotFoundException('THREAD_NOT_FOUND');
    return thread;
  }

  createThread(user: AuthUser, dto: CreateThreadDto) {
    return this.repository.createThread(user, dto);
  }

  listMessages(user: AuthUser, threadId: string) {
    return this.repository.listMessages(user, threadId);
  }

  sendMessage(user: AuthUser, threadId: string, dto: SendMessageDto) {
    return this.repository.sendMessage(user, threadId, dto);
  }
}
