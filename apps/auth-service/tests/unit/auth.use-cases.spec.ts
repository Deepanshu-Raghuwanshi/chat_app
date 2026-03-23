import { expect } from 'chai';
import * as sinon from 'sinon';
import { AuthUseCases } from '../../src/application/use-cases/auth.use-cases';
import bcrypt from 'bcrypt';
import authPayloads from '../fixtures/auth-payloads.json';
import { PrismaService } from '../../src/infrastructure/persistence/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../../src/infrastructure/messaging/email.service';
import { UserEventsProducer } from '../../src/infrastructure/messaging/user-events.producer';

type Stubbed<T> = { [P in keyof T]?: sinon.SinonStub };

describe('AuthUseCases (Unit)', () => {
  let authUseCases: AuthUseCases;
  let prismaMock: Stubbed<PrismaService> & {
    user: Stubbed<PrismaService['user']>;
    emailVerification: Stubbed<PrismaService['emailVerification']>;
    refreshToken: Stubbed<PrismaService['refreshToken']>;
  };
  let jwtServiceMock: Stubbed<JwtService>;
  let emailServiceMock: Stubbed<EmailService>;
  let userEventsProducerMock: Stubbed<UserEventsProducer>;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
      },
      emailVerification: {
        upsert: sinon.stub(),
      },
      refreshToken: {
        create: sinon.stub(),
      },
      $transaction: sinon.stub(),
    } as unknown as Stubbed<PrismaService> & {
      user: Stubbed<PrismaService['user']>;
      emailVerification: Stubbed<PrismaService['emailVerification']>;
      refreshToken: Stubbed<PrismaService['refreshToken']>;
    };

    jwtServiceMock = {
      signAsync: sinon.stub(),
    } as unknown as Stubbed<JwtService>;

    emailServiceMock = {
      sendVerificationEmail: sinon.stub(),
    } as unknown as Stubbed<EmailService>;

    userEventsProducerMock = {
      emitUserCreated: sinon.stub(),
    } as unknown as Stubbed<UserEventsProducer>;

    authUseCases = new AuthUseCases(
      prismaMock as unknown as PrismaService,
      jwtServiceMock as unknown as JwtService,
      emailServiceMock as unknown as EmailService,
      userEventsProducerMock as unknown as UserEventsProducer
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = authPayloads.payloads.register;
      const createdUser = { id: 'new-id', email: registerDto.email };

      prismaMock.user.findUnique?.resolves(null);
      prismaMock.user.create?.resolves(createdUser);
      prismaMock.emailVerification.upsert?.resolves({});
      emailServiceMock.sendVerificationEmail?.resolves();
      userEventsProducerMock.emitUserCreated?.resolves();

      const result = await authUseCases.register(registerDto);

      expect(result).to.deep.equal(createdUser);
      expect(prismaMock.user.create?.calledOnce).to.equal(true);
      expect(emailServiceMock.sendVerificationEmail?.calledOnce).to.equal(true);
      expect(userEventsProducerMock.emitUserCreated?.calledOnce).to.equal(true);
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = authPayloads.payloads.register;
      prismaMock.user.findUnique?.resolves({ id: 'existing-id', email: registerDto.email, provider: 'LOCAL' });

      try {
        await authUseCases.register(registerDto);
        throw new Error('Should have thrown ConflictException');
      } catch (error: unknown) {
        const err = error as { status: number; message: string };
        expect(err.status).to.equal(409);
        expect(err.message).to.equal('User already exists');
      }
    });
  });

  describe('validateUser', () => {
    it('should return user without password if credentials are valid', async () => {
      const user = authPayloads.users.valid;
      prismaMock.user.findUnique?.resolves({ ...user, password: 'hashed_password' });
      
      const bcryptStub = sinon.stub(bcrypt, 'compare').resolves(true);

      const result = await authUseCases.validateUser(user.email, user.password);

      expect(result).to.not.have.property('password');
      expect(result?.email).to.equal(user.email);
      expect(bcryptStub.calledOnce).to.equal(true);
      bcryptStub.restore();
    });

    it('should return null if password is invalid', async () => {
      const user = authPayloads.users.valid;
      prismaMock.user.findUnique?.resolves({ ...user, password: 'hashed_password' });
      
      const bcryptStub = sinon.stub(bcrypt, 'compare').resolves(false);

      const result = await authUseCases.validateUser(user.email, 'WrongPassword');

      expect(result).to.equal(null);
      expect(bcryptStub.calledOnce).to.equal(true);
      bcryptStub.restore();
    });
  });

  describe('login', () => {
    it('should successfully login and return tokens', async () => {
      const user = authPayloads.users.valid;
      const tokens = authPayloads.tokens;

      jwtServiceMock.signAsync?.resolves(tokens.access);
      prismaMock.refreshToken.create?.resolves({});

      const result = await authUseCases.login(user as unknown as { id: string; email: string; isVerified: boolean });

      expect(result.accessToken).to.equal(tokens.access);
      expect(result.user.email).to.equal(user.email);
      expect(jwtServiceMock.signAsync?.calledOnce).to.equal(true);
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      const user = authPayloads.users.unverified;

      try {
        await authUseCases.login(user as unknown as { id: string; email: string; isVerified: boolean });
        throw new Error('Should have thrown UnauthorizedException');
      } catch (error: unknown) {
        const err = error as { status: number; message: string };
        expect(err.status).to.equal(401);
        expect(err.message).to.equal('Please verify your email first');
      }
    });
  });
});
