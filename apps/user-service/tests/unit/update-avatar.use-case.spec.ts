import { expect } from 'chai';
import sinon from 'sinon';
import { UpdateAvatarUseCase } from '../../src/application/use-cases/update-avatar.use-case';
import { UserProfileRepository } from '../../src/application/ports/user-profile.repository';
import { CloudinaryService } from '../../src/infrastructure/cloudinary/cloudinary.service';
import { KafkaProducerService } from '../../src/infrastructure/messaging/kafka-producer.service';
import { NotFoundException } from '@nestjs/common';
import { UserProfile } from '@prisma/client-user';
import { UploadApiResponse } from 'cloudinary';

describe('UpdateAvatarUseCase', () => {
  let updateAvatarUseCase: UpdateAvatarUseCase;
  let userProfileRepository: sinon.SinonStubbedInstance<UserProfileRepository>;
  let cloudinaryService: sinon.SinonStubbedInstance<CloudinaryService>;
  let kafkaProducer: sinon.SinonStubbedInstance<KafkaProducerService>;

  beforeEach(() => {
    userProfileRepository = {
      findById: sinon.stub(),
      update: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<UserProfileRepository>;
    cloudinaryService = {
      uploadImage: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<CloudinaryService>;
    kafkaProducer = {
      emit: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<KafkaProducerService>;
    updateAvatarUseCase = new UpdateAvatarUseCase(
      userProfileRepository,
      cloudinaryService,
      kafkaProducer
    );
  });

  it('should update avatar and emit event', async () => {
    const userId = 'user1';
    const mockFile = { buffer: Buffer.from('test') } as unknown as Express.Multer.File;
    const avatarUrl = 'http://cloudinary.com/avatar.jpg';

    userProfileRepository.findById.resolves({ id: userId, username: 'test1' } as unknown as UserProfile);
    cloudinaryService.uploadImage.resolves({ secure_url: avatarUrl } as unknown as UploadApiResponse);
    userProfileRepository.update.resolves({ id: userId, username: 'test1', avatarUrl } as unknown as UserProfile);

    const result = await updateAvatarUseCase.execute(userId, mockFile);

    expect(result).to.deep.equal({ avatarUrl });
    expect(cloudinaryService.uploadImage.calledWith(mockFile)).to.equal(true);
    expect(userProfileRepository.update.calledWith(userId, { avatarUrl })).to.equal(true);
    expect(kafkaProducer.emit.calledOnce).to.equal(true);
  });

  it('should throw NotFoundException if user profile not found', async () => {
    userProfileRepository.findById.resolves(null);

    try {
      await updateAvatarUseCase.execute('nonexistent', {} as unknown as Express.Multer.File);
      expect.fail('Should have thrown NotFoundException');
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(NotFoundException);
      expect((error as Error).message).to.equal('User profile not found');
    }
  });
});
