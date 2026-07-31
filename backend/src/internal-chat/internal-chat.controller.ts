import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthUser } from '../common/types/auth-user';
import { CreateThreadDto } from './dto/create-thread.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { InternalChatService } from './internal-chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class InternalChatController {
  constructor(private readonly service: InternalChatService) {}

  @Get('threads')
  @RequirePermission('chat.read')
  @ApiOperation({ summary: 'Liste des discussions internes' })
  listThreads(@CurrentUser() user: AuthUser) {
    return this.service.listThreads(user);
  }

  @Post('threads')
  @RequirePermission('chat.manage')
  @ApiOperation({ summary: 'Creer un fil de discussion interne' })
  createThread(@CurrentUser() user: AuthUser, @Body() dto: CreateThreadDto) {
    return this.service.createThread(user, dto);
  }

  @Get('threads/:id')
  @RequirePermission('chat.read')
  @ApiOperation({ summary: 'Detail d un fil de discussion' })
  findThread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findThread(user, id);
  }

  @Get('threads/:id/messages')
  @RequirePermission('chat.read')
  @ApiOperation({ summary: 'Messages d un fil' })
  listMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listMessages(user, id);
  }

  @Post('threads/:id/messages')
  @RequirePermission('chat.send')
  @ApiOperation({ summary: 'Envoyer un message interne' })
  sendMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.service.sendMessage(user, id, dto);
  }
}
