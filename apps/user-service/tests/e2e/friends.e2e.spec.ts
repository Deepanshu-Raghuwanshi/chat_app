import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import supertest from 'supertest';
import { expect } from 'chai';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/persistence/prisma.service';
import { FriendRequestStatus } from '@prisma/client-user';
import { UserEventsConsumer } from '../../src/infrastructure/messaging/user-events.consumer';
import { KafkaProducerService } from '../../src/infrastructure/messaging/kafka-producer.service';

describe('FriendsController (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockUser = { id: 'user1', username: 'test1' };

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UserEventsConsumer)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
      })
      .overrideProvider(KafkaProducerService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
        emit: async () => {},
      })
      .compile();

    app = moduleFixture.createNestApplication();
    
    // Global settings from main.ts (except global filters if lib is not fully available)
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Mock Authentication Middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      (req as unknown as Record<string, unknown>).user = mockUser;
      next();
    });

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.friendRequest.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.userProfile.deleteMany();

    await prisma.userProfile.createMany({
      data: [
        { id: 'user1', username: 'test1' },
        { id: 'user2', username: 'test2' },
        { id: 'user3', username: 'test3' },
      ],
    });
  });

  after(async () => {
    await app.close();
  });

  describe('GET /api/v1/friends', () => {
    it('should return empty list if no friends', async () => {
      const response = await supertest(app.getHttpServer())
        .get('/api/v1/friends')
        .expect(200);

      expect(response.body).to.be.an('array').with.lengthOf(0);
    });

    it('should return friends list', async () => {
      await prisma.friendship.create({
        data: { userId1: 'user1', userId2: 'user2' },
      });

      const response = await supertest(app.getHttpServer())
        .get('/api/v1/friends')
        .expect(200);

      expect(response.body).to.include('user2');
    });
  });

  describe('POST /api/v1/friends/requests', () => {
    it('should send a friend request', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/api/v1/friends/requests')
        .send({ receiverId: 'user2' })
        .expect(201);

      expect(response.body.senderId).to.equal('user1');
      expect(response.body.receiverId).to.equal('user2');
      expect(response.body.status).to.equal(FriendRequestStatus.PENDING);
    });

    it('should return 400 if sending to self', async () => {
      await supertest(app.getHttpServer())
        .post('/api/v1/friends/requests')
        .send({ receiverId: 'user1' })
        .expect(400);
    });
  });

  describe('POST /api/v1/friends/requests/:requestId/respond', () => {
    it('should accept a friend request', async () => {
      const created = await prisma.friendRequest.create({
        data: {
          senderId: 'user2',
          receiverId: 'user1',
          status: FriendRequestStatus.PENDING,
        },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/friends/requests/${created.id}/respond`)
        .send({ action: 'ACCEPT' })
        .expect(201);

      const friendship = await prisma.friendship.findUnique({
        where: { userId1_userId2: { userId1: 'user1', userId2: 'user2' } },
      });
      expect(friendship).to.not.equal(null);

      const updatedRequest = await prisma.friendRequest.findUnique({
        where: { id: created.id },
      });
      expect(updatedRequest?.status).to.equal(FriendRequestStatus.ACCEPTED);
    });

    it('should reject a friend request', async () => {
      const created = await prisma.friendRequest.create({
        data: {
          senderId: 'user2',
          receiverId: 'user1',
          status: FriendRequestStatus.PENDING,
        },
      });

      await supertest(app.getHttpServer())
        .post(`/api/v1/friends/requests/${created.id}/respond`)
        .send({ action: 'REJECT' })
        .expect(201);

      const updatedRequest = await prisma.friendRequest.findUnique({
        where: { id: created.id },
      });
      expect(updatedRequest?.status).to.equal(FriendRequestStatus.REJECTED);
    });
  });
});
