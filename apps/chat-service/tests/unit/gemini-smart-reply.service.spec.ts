import { expect } from "chai";
import * as sinon from "sinon";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GeminiSmartReplyService } from "../../src/infrastructure/ai/gemini-smart-reply.service";

type InternalModel = { generateContent: sinon.SinonStub };

function makeConfigService(apiKey = "test-api-key"): ConfigService {
  return { get: sinon.stub().returns(apiKey) } as unknown as ConfigService;
}

const MESSAGES: Array<{ role: "me" | "them"; content: string }> = [
  { role: "them", content: "Are you free this weekend?" },
];

const THREE_LINE_RESPONSE = "Yes, I'm free!\nSorry, I'm busy\nLet me check";

describe("GeminiSmartReplyService (Unit)", () => {
  let service: GeminiSmartReplyService;
  let generateContentStub: sinon.SinonStub;

  beforeEach(() => {
    service = new GeminiSmartReplyService(makeConfigService());
    generateContentStub = sinon.stub(
      (service as unknown as { model: InternalModel }).model,
      "generateContent",
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("prompt construction", () => {
    it("should include [CONV] and [/CONV] delimiters in the prompt", async () => {
      generateContentStub.resolves({
        response: { text: () => THREE_LINE_RESPONSE },
      });

      await service.generateReplies(MESSAGES);

      const [promptArg]: [string] = generateContentStub.firstCall.args;
      expect(promptArg).to.include("[CONV]");
      expect(promptArg).to.include("[/CONV]");
    });

    it('should map role "me" to "Me:" in the prompt', async () => {
      generateContentStub.resolves({
        response: { text: () => THREE_LINE_RESPONSE },
      });
      const messages: Array<{ role: "me" | "them"; content: string }> = [
        { role: "me", content: "Hey!" },
        { role: "them", content: "Hi there" },
      ];

      await service.generateReplies(messages);

      const [promptArg]: [string] = generateContentStub.firstCall.args;
      expect(promptArg).to.include("Me: Hey!");
    });

    it('should map role "them" to "Them:" in the prompt', async () => {
      generateContentStub.resolves({
        response: { text: () => THREE_LINE_RESPONSE },
      });

      await service.generateReplies(MESSAGES);

      const [promptArg]: [string] = generateContentStub.firstCall.args;
      expect(promptArg).to.include("Them: Are you free this weekend?");
    });
  });

  describe("response parsing", () => {
    it("should return exactly 3 strings when Gemini returns 3 non-empty lines", async () => {
      generateContentStub.resolves({
        response: { text: () => THREE_LINE_RESPONSE },
      });

      const result = await service.generateReplies(MESSAGES);

      expect(result).to.have.length(3);
      expect(result[0]).to.equal("Yes, I'm free!");
      expect(result[1]).to.equal("Sorry, I'm busy");
      expect(result[2]).to.equal("Let me check");
    });

    it("should pad to 3 with '...' when Gemini returns only 1 line", async () => {
      generateContentStub.resolves({
        response: { text: () => "Sure thing" },
      });

      const result = await service.generateReplies(MESSAGES);

      expect(result).to.have.length(3);
      expect(result[0]).to.equal("Sure thing");
      expect(result[1]).to.equal("...");
      expect(result[2]).to.equal("...");
    });

    it("should pad to 3 with '...' when Gemini returns 2 lines", async () => {
      generateContentStub.resolves({
        response: { text: () => "Sure thing\nCan't make it" },
      });

      const result = await service.generateReplies(MESSAGES);

      expect(result).to.have.length(3);
      expect(result[2]).to.equal("...");
    });

    it("should truncate at 3 when Gemini returns more than 3 lines", async () => {
      generateContentStub.resolves({
        response: {
          text: () => "Reply 1\nReply 2\nReply 3\nReply 4\nReply 5",
        },
      });

      const result = await service.generateReplies(MESSAGES);

      expect(result).to.have.length(3);
      expect(result[2]).to.equal("Reply 3");
    });

    it("should filter out blank lines from Gemini response", async () => {
      generateContentStub.resolves({
        response: { text: () => "Reply 1\n\nReply 2\n\nReply 3" },
      });

      const result = await service.generateReplies(MESSAGES);

      expect(result).to.have.length(3);
      expect(result).to.deep.equal(["Reply 1", "Reply 2", "Reply 3"]);
    });
  });

  describe("timeout handling", () => {
    it("should throw ServiceUnavailableException when generateContent takes longer than 10 s", async () => {
      const clock = sinon.useFakeTimers();
      generateContentStub.returns(new Promise(() => {}));

      const promise = service.generateReplies(MESSAGES);
      await clock.tickAsync(10_001);

      try {
        await promise;
        expect.fail("Should have thrown ServiceUnavailableException");
      } catch (err) {
        expect(err).to.be.instanceOf(ServiceUnavailableException);
      } finally {
        clock.restore();
      }
    });

    it("should NOT throw when generateContent resolves within 10 s", async () => {
      const clock = sinon.useFakeTimers();
      generateContentStub.resolves({
        response: { text: () => THREE_LINE_RESPONSE },
      });

      const promise = service.generateReplies(MESSAGES);
      await clock.tickAsync(1_000);
      const result = await promise;

      expect(result).to.have.length(3);
      clock.restore();
    });
  });

  describe("error handling", () => {
    it("should throw ServiceUnavailableException on any Gemini API error", async () => {
      generateContentStub.rejects(new Error("network failure"));

      try {
        await service.generateReplies(MESSAGES);
        expect.fail("Should have thrown ServiceUnavailableException");
      } catch (err) {
        expect(err).to.be.instanceOf(ServiceUnavailableException);
      }
    });

    it("should re-throw ServiceUnavailableException from the timeout without wrapping", async () => {
      const clock = sinon.useFakeTimers();
      generateContentStub.returns(new Promise(() => {}));

      const promise = service.generateReplies(MESSAGES);
      await clock.tickAsync(10_001);

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(ServiceUnavailableException);
        expect((err as ServiceUnavailableException).message).to.include(
          "timed out",
        );
      } finally {
        clock.restore();
      }
    });
  });
});
