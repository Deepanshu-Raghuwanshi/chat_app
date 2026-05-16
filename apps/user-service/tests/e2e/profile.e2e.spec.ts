import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import supertest from "supertest";
import { expect } from "chai";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/infrastructure/persistence/prisma.service";
import { UserEventsConsumer } from "../../src/infrastructure/messaging/user-events.consumer";
import { KafkaProducerService } from "../../src/infrastructure/messaging/kafka-producer.service";
import { JwtAuthGuard } from "../../src/infrastructure/guards/jwt-auth.guard";

describe("UserController (E2E)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockUser = { id: "user1", username: "test1" };

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
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

    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    app.use((req: Request, res: Response, next: NextFunction) => {
      (req as unknown as Record<string, unknown>).user = mockUser;
      next();
    });

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.userProfile.deleteMany();
    await prisma.userProfile.create({
      data: { id: "user1", username: "test1", theme: "light" },
    });
  });

  after(async () => {
    await app.close();
  });

  describe("PATCH /api/v1/profile", () => {
    it("should return 400 when theme is an invalid value", async () => {
      const response = await supertest(app.getHttpServer())
        .patch("/api/v1/profile")
        .send({ theme: "blue" })
        .expect(400);

      expect(response.body.statusCode).to.equal(400);
    });

    it("should update theme to dark and return updated profile", async () => {
      const response = await supertest(app.getHttpServer())
        .patch("/api/v1/profile")
        .send({ theme: "dark" })
        .expect(200);

      expect(response.body.theme).to.equal("dark");
    });

    it("should update theme to light and return updated profile", async () => {
      await prisma.userProfile.update({
        where: { id: "user1" },
        data: { theme: "dark" },
      });

      const response = await supertest(app.getHttpServer())
        .patch("/api/v1/profile")
        .send({ theme: "light" })
        .expect(200);

      expect(response.body.theme).to.equal("light");
    });

    it("should update other fields without changing theme", async () => {
      const response = await supertest(app.getHttpServer())
        .patch("/api/v1/profile")
        .send({ fullName: "Test User" })
        .expect(200);

      expect(response.body.fullName).to.equal("Test User");
      expect(response.body.theme).to.equal("light");
    });
  });
});
