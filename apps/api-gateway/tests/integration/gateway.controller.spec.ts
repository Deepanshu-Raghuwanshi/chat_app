import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, HttpStatus } from "@nestjs/common";
import request from "supertest";
import { expect } from "chai";
import nock from "nock";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GatewayController } from "../../src/interfaces/controllers/gateway.controller";
import {
  TEST_AUTH_SERVICE_URL,
  TEST_USER_SERVICE_URL,
  TEST_CORS_ORIGIN,
} from "@shared-utils";
import proxyPayloads from "../fixtures/proxy-payloads.json";

describe("GatewayController (Integration)", () => {
  let app: INestApplication;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              AUTH_SERVICE_URL: TEST_AUTH_SERVICE_URL,
              USER_SERVICE_URL: TEST_USER_SERVICE_URL,
              CORS_ORIGIN: TEST_CORS_ORIGIN,
            }),
          ],
        }),
      ],
      controllers: [GatewayController],
      providers: [ConfigService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => {
    if (app) await app.close();
    nock.cleanAll();
  });

  describe("Proxying to Auth Service", () => {
    it("should proxy registration request to auth-service", async () => {
      const registerData = {
        email: "test@example.com",
        password: "Password123",
      };
      const expectedResponse = proxyPayloads.proxyResponses.auth.register;

      nock(TEST_AUTH_SERVICE_URL)
        .post("/api/v1/auth/register", registerData)
        .reply(expectedResponse.status, expectedResponse.body);

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send(registerData);

      expect(response.status).to.equal(HttpStatus.CREATED);
      expect(response.body).to.deep.equal(expectedResponse.body);
    });

    it("should proxy login request and forward cookies", async () => {
      const loginData = { email: "test@example.com", password: "Password123" };
      const expectedResponse = proxyPayloads.proxyResponses.auth.login;

      nock(TEST_AUTH_SERVICE_URL)
        .post("/api/v1/auth/login", loginData)
        .reply(
          expectedResponse.status,
          expectedResponse.body,
          expectedResponse.headers,
        );

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send(loginData);

      expect(response.status).to.equal(HttpStatus.OK);
      expect(response.body).to.deep.equal(expectedResponse.body);
      expect(response.headers["set-cookie"]).to.deep.equal(
        expectedResponse.headers["set-cookie"],
      );
    });

    it("should return 404 if service is not configured", async () => {
      const response = await request(app.getHttpServer()).get(
        "/unknown-service/some-route",
      );

      expect(response.status).to.equal(HttpStatus.NOT_FOUND);
      expect(response.body.message).to.contain(
        "Service 'unknown-service' not found",
      );
    });
  });

  describe("Error Handling", () => {
    it("should forward 500 error from auth-service", async () => {
      const expectedResponse = proxyPayloads.proxyResponses.errors.serverError;

      nock(TEST_AUTH_SERVICE_URL)
        .get("/api/v1/auth/health")
        .reply(expectedResponse.status, expectedResponse.body);

      const response = await request(app.getHttpServer()).get("/auth/health");

      expect(response.status).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.body).to.deep.equal(expectedResponse.body);
    });

    it("should return 500 when target service is down", async () => {
      const response = await request(app.getHttpServer()).get(
        "/auth/some-route",
      );

      expect(response.status).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(response.body.message).to.contain(
        "Error communicating with auth service",
      );
    });
  });
});
