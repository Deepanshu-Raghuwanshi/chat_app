import { expect } from "chai";
import * as sinon from "sinon";
import { ServiceUnavailableException } from "@nestjs/common";
import { GenerateSmartRepliesUseCase } from "../../src/application/use-cases/generate-smart-replies.use-case";
import { AiSmartReplierPort } from "../../src/application/ports/ai-smart-reply.port";

const THREE_SUGGESTIONS = ["Yes, I'm free!", "Sorry, I'm busy", "Let me check"];

const MESSAGES: Array<{ role: "me" | "them"; content: string }> = [
  { role: "them", content: "Are you free this weekend?" },
];

describe("GenerateSmartRepliesUseCase (Unit)", () => {
  let useCase: GenerateSmartRepliesUseCase;
  let aiSmartReplierMock: { generateReplies: sinon.SinonStub };

  beforeEach(() => {
    aiSmartReplierMock = { generateReplies: sinon.stub() };
    useCase = new GenerateSmartRepliesUseCase(
      aiSmartReplierMock as unknown as AiSmartReplierPort,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("success path", () => {
    it("should call generateReplies with the messages array and return { suggestions }", async () => {
      aiSmartReplierMock.generateReplies.resolves(THREE_SUGGESTIONS);

      const result = await useCase.execute({
        userId: "user-1",
        messages: MESSAGES,
      });

      expect(result).to.deep.equal({ suggestions: THREE_SUGGESTIONS });
      expect(aiSmartReplierMock.generateReplies.calledOnce).to.equal(true);
    });

    it("should pass the full messages array unchanged to the port", async () => {
      aiSmartReplierMock.generateReplies.resolves(THREE_SUGGESTIONS);
      const multiMessages: Array<{ role: "me" | "them"; content: string }> = [
        { role: "me", content: "Hey" },
        { role: "them", content: "Hi there!" },
        { role: "them", content: "Are you free this weekend?" },
      ];

      await useCase.execute({ userId: "u1", messages: multiMessages });

      expect(
        aiSmartReplierMock.generateReplies.firstCall.args[0],
      ).to.deep.equal(multiMessages);
    });

    it("should return whatever array the port returns without further transformation", async () => {
      const portOutput = ["Sure!", "Can't make it", "..."];
      aiSmartReplierMock.generateReplies.resolves(portOutput);

      const result = await useCase.execute({
        userId: "u1",
        messages: MESSAGES,
      });

      expect(result.suggestions).to.equal(portOutput);
    });
  });

  describe("failure paths", () => {
    it("should propagate ServiceUnavailableException thrown by the port", async () => {
      const portError = new ServiceUnavailableException(
        "AI provider timed out",
      );
      aiSmartReplierMock.generateReplies.rejects(portError);

      try {
        await useCase.execute({ userId: "u1", messages: MESSAGES });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.equal(portError);
      }
    });

    it("should propagate any error thrown by the port", async () => {
      const portError = new Error("unexpected failure");
      aiSmartReplierMock.generateReplies.rejects(portError);

      try {
        await useCase.execute({ userId: "u1", messages: MESSAGES });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.equal(portError);
      }
    });
  });
});
