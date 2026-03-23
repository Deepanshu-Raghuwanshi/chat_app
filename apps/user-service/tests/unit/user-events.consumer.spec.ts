import { expect } from 'chai';
import * as sinon from 'sinon';
import { Kafka, Consumer } from 'kafkajs';
import { UserEventsConsumer } from '../../src/infrastructure/messaging/user-events.consumer';
import dummyData from '../fixtures/user-data.json';

describe('UserEventsConsumer (Unit)', () => {
  let consumerService: UserEventsConsumer;
  let prismaMock: {
    userProfile: {
      upsert: sinon.SinonStub;
    };
  };
  let mockConsumer: {
    connect: sinon.SinonStub;
    subscribe: sinon.SinonStub;
    run: sinon.SinonStub;
    disconnect: sinon.SinonStub;
  };

  beforeEach(() => {
    prismaMock = {
      userProfile: {
        upsert: sinon.stub().resolves({}),
      },
    };

    mockConsumer = {
      connect: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(),
      run: sinon.stub().resolves(),
      disconnect: sinon.stub().resolves(),
    };

    sinon.stub(Kafka.prototype, 'consumer').returns(mockConsumer as unknown as Consumer);

    consumerService = new UserEventsConsumer(prismaMock as unknown as never);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('onModuleInit', () => {
    it('should connect and subscribe to USER_CREATED topic', async () => {
      await consumerService.onModuleInit();

      expect(mockConsumer.connect.calledOnce).to.equal(true);
      expect(mockConsumer.subscribe.calledWith({
        topic: 'user.created.v1',
        fromBeginning: true,
      })).to.equal(true);
      expect(mockConsumer.run.calledOnce).to.equal(true);
    });
  });

  describe('handleUserCreated', () => {
    it('should upsert a user profile when event is received', async () => {
      const event = dummyData.events.userCreated;
      
      // Accessing private method for testing
      await (consumerService as unknown as {
        handleUserCreated: (e: typeof event) => Promise<void>
      }).handleUserCreated(event);

      expect(prismaMock.userProfile.upsert.calledOnce).to.equal(true);
      const upsertArgs = prismaMock.userProfile.upsert.getCall(0).args[0];
      expect(upsertArgs.where.id).to.equal(event.id);
      expect(upsertArgs.create.id).to.equal(event.id);
      expect(upsertArgs.create.fullName).to.equal('test');
    });

    it('should handle errors gracefully during profile creation', async () => {
      const event = dummyData.events.userCreated;
      prismaMock.userProfile.upsert.rejects(new Error('Database Error'));

      // Should not throw
      await (consumerService as unknown as {
        handleUserCreated: (e: typeof event) => Promise<void>
      }).handleUserCreated(event);
      
      expect(prismaMock.userProfile.upsert.calledOnce).to.equal(true);
    });
  });
});
