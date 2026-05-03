import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { UpdateAvatarUseCase } from '../../application/use-cases/update-avatar.use-case';
import { UpdateProfileDto } from '../../application/dto/update-profile.dto';

import { UserProfile } from '@prisma/client-user';

interface RequestWithUser extends Request {
  user: UserProfile;
}

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class UserController {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly updateAvatarUseCase: UpdateAvatarUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: RequestWithUser) {
    return this.getProfileUseCase.execute(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async getProfileById(@Req() req: RequestWithUser) {
    const id = String(req.params.id);
    return this.getProfileUseCase.execute(id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Req() req: RequestWithUser, @Body() updateProfileDto: UpdateProfileDto) {
    return this.updateProfileUseCase.execute({
      userId: req.user.id,
      ...updateProfileDto,
    });
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile picture' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.updateAvatarUseCase.execute(req.user.id, file);
  }
}
