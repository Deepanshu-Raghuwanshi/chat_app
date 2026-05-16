import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { RequestWithUser } from "../request-with-user.interface";
import { JwtAuthGuard } from "../../infrastructure/guards/jwt-auth.guard";
import { UserThrottlerGuard } from "../../infrastructure/guards/user-throttler.guard";
import { RewriteMessageUseCase } from "../../application/use-cases/rewrite-message.use-case";
import { AiRewriteDto } from "../../application/dto/ai-rewrite.dto";

@ApiTags("AI")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
@Throttle({ default: { limit: 15, ttl: 60_000 } })
@Controller("chat/ai")
export class AiController {
  constructor(private readonly rewriteMessage: RewriteMessageUseCase) {}

  @Post("rewrite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rewrite a draft message using Gemini AI" })
  @ApiBody({ type: AiRewriteDto })
  @ApiResponse({
    status: 200,
    description: "Rewritten text",
    schema: { properties: { rewrittenText: { type: "string" } } },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request (empty text or unknown tone)",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded (15 RPM per user)",
  })
  @ApiResponse({
    status: 503,
    description: "AI provider unavailable or timed out",
  })
  async rewrite(
    @Req() req: RequestWithUser,
    @Body() dto: AiRewriteDto,
  ): Promise<{ rewrittenText: string }> {
    return this.rewriteMessage.execute({
      userId: req.user.id,
      text: dto.text,
      tone: dto.tone,
    });
  }
}
