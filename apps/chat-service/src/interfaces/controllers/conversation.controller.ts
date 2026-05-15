import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from "@nestjs/swagger";
import { RequestWithUser } from "../request-with-user.interface";
import { JwtAuthGuard } from "../../infrastructure/guards/jwt-auth.guard";
import { CreateOrGetConversationUseCase } from "../../application/use-cases/create-or-get-conversation.use-case";
import { GetConversationUseCase } from "../../application/use-cases/get-conversation.use-case";
import { ListConversationsUseCase } from "../../application/use-cases/list-conversations.use-case";
import { GetMessagesUseCase } from "../../application/use-cases/get-messages.use-case";
import { SendMessageUseCase } from "../../application/use-cases/send-message.use-case";
import { EditMessageUseCase } from "../../application/use-cases/edit-message.use-case";
import { DeleteMessageUseCase } from "../../application/use-cases/delete-message.use-case";
import { MarkConversationReadUseCase } from "../../application/use-cases/mark-conversation-read.use-case";
import { SearchConversationsUseCase } from "../../application/use-cases/search-conversations.use-case";
import { ToggleReactionUseCase } from "../../application/use-cases/toggle-reaction.use-case";
import {
  CreateConversationDto,
  ListConversationsQueryDto,
} from "../../application/dto/conversation.dto";
import {
  SendMessageDto,
  EditMessageDto,
  GetMessagesQueryDto,
  ToggleReactionDto,
} from "../../application/dto/message.dto";

@ApiTags("Chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat/conversations")
export class ConversationController {
  constructor(
    private readonly createOrGetConversation: CreateOrGetConversationUseCase,
    private readonly getConversation: GetConversationUseCase,
    private readonly listConversations: ListConversationsUseCase,
    private readonly searchConversations: SearchConversationsUseCase,
    private readonly getMessages: GetMessagesUseCase,
    private readonly sendMessage: SendMessageUseCase,
    private readonly editMessage: EditMessageUseCase,
    private readonly deleteMessage: DeleteMessageUseCase,
    private readonly markConversationRead: MarkConversationReadUseCase,
    private readonly toggleReactionUseCase: ToggleReactionUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List or search conversations for the authenticated user",
  })
  @ApiResponse({
    status: 200,
    description: "Conversation list or search results",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query — q must be at least 1 character",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async list(
    @Req() req: RequestWithUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    if (query.q) {
      return this.searchConversations.execute({
        userId: req.user.id,
        q: query.q,
      });
    }
    return this.listConversations.execute({
      userId: req.user.id,
      limit: query.limit,
      before: query.before,
    });
  }

  @Post()
  @ApiOperation({ summary: "Create or retrieve a conversation with a friend" })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 200, description: "Existing conversation returned" })
  @ApiResponse({ status: 201, description: "New conversation created" })
  async createOrGet(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateConversationDto,
  ) {
    const result = await this.createOrGetConversation.execute({
      userId: req.user.id,
      targetUserId: dto.targetUserId,
      callerUsername: dto.callerUsername,
      callerFullName: dto.callerFullName,
      callerAvatarUrl: dto.callerAvatarUrl,
      targetUsername: dto.targetUsername,
      targetFullName: dto.targetFullName,
      targetAvatarUrl: dto.targetAvatarUrl,
    });

    res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK);
    return result.conversation;
  }

  @Get(":conversationId")
  @ApiOperation({ summary: "Get a conversation by ID" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Conversation details" })
  async getOne(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.getConversation.execute({
      userId: req.user.id,
      conversationId,
    });
  }

  @Get(":conversationId/messages")
  @ApiOperation({ summary: "Get messages in a conversation (newest first)" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Paginated message list" })
  async listMessages(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.getMessages.execute({
      userId: req.user.id,
      conversationId,
      limit: query.limit,
      before: query.before,
    });
  }

  @Post(":conversationId/messages")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Send a message" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: "Message sent" })
  async send(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.sendMessage.execute({
      userId: req.user.id,
      conversationId,
      content: dto.content,
      type: dto.type,
      quotedMessageId: dto.quotedMessageId,
    });
  }

  @Patch(":conversationId/messages/:messageId")
  @ApiOperation({ summary: "Edit a message (sender only)" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "messageId", format: "uuid" })
  @ApiBody({ type: EditMessageDto })
  @ApiResponse({ status: 200, description: "Updated message" })
  async edit(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.editMessage.execute({
      userId: req.user.id,
      conversationId,
      messageId,
      content: dto.content,
    });
  }

  @Delete(":conversationId/messages/:messageId")
  @ApiOperation({ summary: "Soft-delete a message (sender only)" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "messageId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Message tombstoned" })
  async remove(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
  ) {
    return this.deleteMessage.execute({
      userId: req.user.id,
      conversationId,
      messageId,
    });
  }

  @Post(":conversationId/messages/:messageId/reactions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle an emoji reaction on a message" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiParam({ name: "messageId", format: "uuid" })
  @ApiBody({ type: ToggleReactionDto })
  @ApiResponse({
    status: 200,
    description: "Updated message with current reactions",
  })
  async react(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.toggleReactionUseCase.execute({
      userId: req.user.id,
      conversationId,
      messageId,
      emoji: dto.emoji,
    });
  }

  @Post(":conversationId/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark conversation as read" })
  @ApiParam({ name: "conversationId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Read cursor updated" })
  async markRead(
    @Req() req: RequestWithUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.markConversationRead.execute({
      userId: req.user.id,
      conversationId,
    });
  }
}
