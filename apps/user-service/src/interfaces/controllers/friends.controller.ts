import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { SendFriendRequestUseCase } from '../../application/use-cases/send-friend-request.use-case';
import { RespondToFriendRequestUseCase } from '../../application/use-cases/respond-to-friend-request.use-case';
import { GetFriendsUseCase } from '../../application/use-cases/get-friends.use-case';
import { GetIncomingRequestsUseCase } from '../../application/use-cases/get-incoming-requests.use-case';
import { GetOutgoingRequestsUseCase } from '../../application/use-cases/get-outgoing-requests.use-case';
import { GetRecommendationsUseCase } from '../../application/use-cases/get-recommendations.use-case';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(
    private readonly sendFriendRequestUseCase: SendFriendRequestUseCase,
    private readonly respondToFriendRequestUseCase: RespondToFriendRequestUseCase,
    private readonly getFriendsUseCase: GetFriendsUseCase,
    private readonly getIncomingRequestsUseCase: GetIncomingRequestsUseCase,
    private readonly getOutgoingRequestsUseCase: GetOutgoingRequestsUseCase,
    private readonly getRecommendationsUseCase: GetRecommendationsUseCase,
  ) {}

  @Get()
  async getFriends(@Req() req: AuthenticatedRequest) {
    return this.getFriendsUseCase.execute(req.user.id);
  }

  @Get('recommendations')
  async getRecommendations(@Req() req: AuthenticatedRequest) {
    return this.getRecommendationsUseCase.execute(req.user.id);
  }

  @Get('requests/incoming')
  async getIncomingRequests(@Req() req: AuthenticatedRequest) {
    return this.getIncomingRequestsUseCase.execute(req.user.id);
  }

  @Get('requests/outgoing')
  async getOutgoingRequests(@Req() req: AuthenticatedRequest) {
    return this.getOutgoingRequestsUseCase.execute(req.user.id);
  }

  @Post('requests')
  async sendRequest(@Req() req: AuthenticatedRequest, @Body() body: { receiverId: string }) {
    return this.sendFriendRequestUseCase.execute({
      senderId: req.user.id,
      receiverId: body.receiverId,
    });
  }

  @Post('requests/:requestId/respond')
  async respondToRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
    @Body() body: { action: 'ACCEPT' | 'REJECT' }
  ) {
    return this.respondToFriendRequestUseCase.execute({
      requestId,
      userId: req.user.id,
      action: body.action,
    });
  }
}
