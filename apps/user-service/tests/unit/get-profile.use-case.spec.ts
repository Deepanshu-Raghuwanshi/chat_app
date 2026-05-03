import { expect } from 'chai';
import sinon from 'sinon';
import { GetProfileUseCase } from '../../src/application/use-cases/get-profile.use-case';
import { UserProfileRepository } from '../../src/application/ports/user-profile.repository';
import { NotFoundException } from '@nestjs/common';
import { UserProfile } from '@prisma/client-user';

describe('GetProfileUseCase', () => {
  let getProfileUseCase: GetProfileUseCase;
  let userProfileRepository: sinon.SinonStubbedInstance<UserProfileRepository>;

  beforeEach(() => {
    userProfileRepository = {
      findById: sinon.stub(),
      findByUsername: sinon.stub(),
      findByEmail: sinon.stub(),
      create: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
      findMany: sinon.stub(),
    } as unknown as sinon.SinonStubbedInstance<UserProfileRepository>;
    getProfileUseCase = new GetProfileUseCase(userProfileRepository);
  });

  it('should return user profile if found', async () => {
    const mockUser = { id: 'user1', username: 'test1', fullName: 'Test User' } as UserProfile;
    userProfileRepository.findById.resolves(mockUser);

    const result = await getProfileUseCase.execute('user1');

    expect(result).to.deep.equal(mockUser);
    expect(userProfileRepository.findById.calledWith('user1')).to.equal(true);
  });

  it('should throw NotFoundException if user profile not found', async () => {
    userProfileRepository.findById.resolves(null);

    try {
      await getProfileUseCase.execute('nonexistent');
      expect.fail('Should have thrown NotFoundException');
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(NotFoundException);
      expect((error as Error).message).to.equal('User profile not found');
    }
  });
});
