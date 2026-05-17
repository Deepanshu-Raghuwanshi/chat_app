import { expect } from "chai";
import * as sinon from "sinon";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SummarizeConversationUseCase } from "../../src/application/use-cases/summarize-conversation.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { MessageRepository } from "../../src/application/ports/message.repository";
import { AiSummarizerPort } from "../../src/application/ports/ai-summarizer.port";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationParticipantEntity } from "../../src/domain/entities/conversation-participant.entity";
import { MessageEntity } from "../../src/domain/entities/message.entity";

function makeConversation(): ConversationEntity {
  return ConversationEntity.create({
    id: "conv-1",
    participant1Id: "user-1",
    participant2Id: "user-2",
    lastActivityAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

function makeParticipant(userId: string): ConversationParticipantEntity {
  return ConversationParticipantEntity.create({
    id: `part-${userId}`,
    conversationId: "conv-1",
    userId,
    username: `${userId}-name`,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

function makeMessage(
  id: string,
  senderId = "user-1",
  isDeleted = false,
): MessageEntity {
  return MessageEntity.create({
    id,
    conversationId: "conv-1",
    senderId,
    content: `content of ${id}`,
    type: "TEXT",
    status: "SENT",
    isDeleted,
    isEdited: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

describe("SummarizeConversationUseCase (Unit)", () => {
  let useCase: SummarizeConversationUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let messageRepoMock: Record<string, sinon.SinonStub>;
  let aiSummarizerMock: { summarize: sinon.SinonStub };

  beforeEach(() => {
    conversationRepoMock = { findById: sinon.stub() };
    participantRepoMock = {
      findByConversationAndUser: sinon.stub(),
    };
    messageRepoMock = { findByConversationId: sinon.stub() };
    aiSummarizerMock = { summarize: sinon.stub() };

    useCase = new SummarizeConversationUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      participantRepoMock as unknown as ConversationParticipantRepository,
      messageRepoMock as unknown as MessageRepository,
      aiSummarizerMock as unknown as AiSummarizerPort,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("success path", () => {
    it("should return { summary } from the AI port on the happy path", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-1", "user-1"),
        makeMessage("msg-2", "user-2"),
      ]);
      aiSummarizerMock.summarize.resolves("• They exchanged greetings.");

      const result = await useCase.execute({
        userId: "user-1",
        conversationId: "conv-1",
      });

      expect(result).to.deep.equal({ summary: "• They exchanged greetings." });
    });

    it("should use DEFAULT_LIMIT of 50 when limit is not provided", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([makeMessage("msg-1")]);
      aiSummarizerMock.summarize.resolves("• summary");

      await useCase.execute({ userId: "user-1", conversationId: "conv-1" });

      const [, limit] = messageRepoMock.findByConversationId.firstCall.args;
      expect(limit).to.equal(50);
    });

    it("should pass caller's limit to the message repository when provided", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([makeMessage("msg-1")]);
      aiSummarizerMock.summarize.resolves("• summary");

      await useCase.execute({
        userId: "user-1",
        conversationId: "conv-1",
        limit: 10,
      });

      const [, limit] = messageRepoMock.findByConversationId.firstCall.args;
      expect(limit).to.equal(10);
    });

    it("should map caller userId → role 'me' and other senderId → role 'them'", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      // Repository returns newest-first; use case reverses to oldest-first
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-2", "user-2"),
        makeMessage("msg-1", "user-1"),
      ]);
      aiSummarizerMock.summarize.resolves("• summary");

      await useCase.execute({ userId: "user-1", conversationId: "conv-1" });

      const formatted: Array<{ role: string; content: string }> =
        aiSummarizerMock.summarize.firstCall.args[0];
      // After reversing: msg-1 (user-1 = 'me') first, msg-2 (user-2 = 'them') second
      expect(formatted[0].role).to.equal("me");
      expect(formatted[0].content).to.equal("content of msg-1");
      expect(formatted[1].role).to.equal("them");
      expect(formatted[1].content).to.equal("content of msg-2");
    });

    it("should reverse messages to oldest-first before passing to the AI port", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-3", "user-1"),
        makeMessage("msg-2", "user-2"),
        makeMessage("msg-1", "user-1"),
      ]);
      aiSummarizerMock.summarize.resolves("• summary");

      await useCase.execute({ userId: "user-1", conversationId: "conv-1" });

      const formatted: Array<{ role: string; content: string }> =
        aiSummarizerMock.summarize.firstCall.args[0];
      expect(formatted[0].content).to.equal("content of msg-1");
      expect(formatted[1].content).to.equal("content of msg-2");
      expect(formatted[2].content).to.equal("content of msg-3");
    });

    it("should exclude deleted messages from the array passed to the AI port", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-3", "user-2", false),
        makeMessage("msg-2", "user-1", true),
        makeMessage("msg-1", "user-1", false),
      ]);
      aiSummarizerMock.summarize.resolves("• summary");

      await useCase.execute({ userId: "user-1", conversationId: "conv-1" });

      const formatted: Array<{ content: string }> =
        aiSummarizerMock.summarize.firstCall.args[0];
      expect(formatted).to.have.length(2);
      const contents = formatted.map((m) => m.content);
      expect(contents).to.not.include("content of msg-2");
    });
  });

  describe("failure paths", () => {
    it("should throw NotFoundException when conversation does not exist", async () => {
      conversationRepoMock.findById.resolves(null);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
        expect.fail("Should have thrown NotFoundException");
      } catch (err) {
        expect(err).to.be.instanceOf(NotFoundException);
      }
    });

    it("should NOT call participant repo or AI port when conversation is not found", async () => {
      conversationRepoMock.findById.resolves(null);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
      } catch {
        // expected
      }

      expect(participantRepoMock.findByConversationAndUser.called).to.equal(
        false,
      );
      expect(aiSummarizerMock.summarize.called).to.equal(false);
    });

    it("should throw ForbiddenException when requester is not a participant", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(null);

      try {
        await useCase.execute({ userId: "user-3", conversationId: "conv-1" });
        expect.fail("Should have thrown ForbiddenException");
      } catch (err) {
        expect(err).to.be.instanceOf(ForbiddenException);
      }
    });

    it("should NOT call AI port when participant guard fails", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(null);

      try {
        await useCase.execute({ userId: "user-3", conversationId: "conv-1" });
      } catch {
        // expected
      }

      expect(aiSummarizerMock.summarize.called).to.equal(false);
    });

    it("should throw BadRequestException when all fetched messages are deleted", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-1", "user-1", true),
        makeMessage("msg-2", "user-2", true),
      ]);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
        expect.fail("Should have thrown BadRequestException");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });

    it("should throw BadRequestException when repository returns no messages", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([]);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
        expect.fail("Should have thrown BadRequestException");
      } catch (err) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });

    it("should NOT call AI port when message list is empty after filtering", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([
        makeMessage("msg-1", "user-1", true),
      ]);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
      } catch {
        // expected
      }

      expect(aiSummarizerMock.summarize.called).to.equal(false);
    });

    it("should propagate ServiceUnavailableException from the AI port", async () => {
      conversationRepoMock.findById.resolves(makeConversation());
      participantRepoMock.findByConversationAndUser.resolves(
        makeParticipant("user-1"),
      );
      messageRepoMock.findByConversationId.resolves([makeMessage("msg-1")]);
      const portError = new ServiceUnavailableException("AI timed out");
      aiSummarizerMock.summarize.rejects(portError);

      try {
        await useCase.execute({ userId: "user-1", conversationId: "conv-1" });
        expect.fail("Should have thrown ServiceUnavailableException");
      } catch (err) {
        expect(err).to.equal(portError);
      }
    });
  });
});
