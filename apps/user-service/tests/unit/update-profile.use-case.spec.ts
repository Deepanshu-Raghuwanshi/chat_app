import { expect } from 'chai';
import sinon from 'sinon';
import { UpdateProfileUseCase } from '../../src/application/use-cases/update-profile.use-case';
import { UserProfileRepository } from '../../src/application/ports/user-profile.repository';
import { KafkaProducerService } from '../../src/infrastructure/messaging/kafka-producer.service';
import { NotFoundException } from '@nestjs/common';
import { UserProfile } from '@prisma/client-user';

describe('UpdateProfileUseCase', () => {
  let updateProfileUseCase: UpdateProfileUseCase;
  let userProfileRepository: sinon.SinonStubbedInstance<UserProfileRepository>;
  let kafkaProducer: sinon.SinonStubbedInstance<KafkaProducerService>;

  beforeEach(() => {
    userProfileRepository = {
      findById: sinon.stub(),
      update: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<UserProfileRepository>;
    kafkaProducer = {
      emit: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<KafkaProducerService>;
    updateProfileUseCase = new UpdateProfileUseCase(userProfileRepository, kafkaProducer);
  });

  it('should update profile and emit event', async () => {
    const userId = 'user1';
    const updateData = { fullName: 'Updated Name', bio: 'New Bio' };
    const mockUser = { id: userId, username: 'test1', ...updateData } as unknown as UserProfile;

    userProfileRepository.findById.resolves({ id: userId, username: 'test1' } as unknown as UserProfile);
    userProfileRepository.update.resolves(mockUser);

    const result = await updateProfileUseCase.execute({ userId, ...updateData });

    expect(result).to.deep.equal(mockUser);
    expect(userProfileRepository.update.calledWith(userId, updateData)).to.equal(true);
    expect(kafkaProducer.emit.calledOnce).to.equal(true);
    expect(kafkaProducer.emit.firstCall.args[0]).to.equal('user.profile.updated');
  });

  it('should throw NotFoundException if user profile not found', async () => {
    userProfileRepository.findById.resolves(null);

    try {
      await updateProfileUseCase.execute({ userId: 'nonexistent', fullName: 'New Name' });
      expect.fail('Should have thrown NotFoundException');
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(NotFoundException);
      expect((error as Error).message).to.equal('User profile not found');
    }
  });
});
