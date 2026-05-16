import { expect } from "chai";
import * as sinon from "sinon";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GeminiRewriteService } from "../../src/infrastructure/ai/gemini-rewrite.service";

function makeConfigService(apiKey = "test-api-key"): ConfigService {
  return { get: sinon.stub().returns(apiKey) } as unknown as ConfigService;
}

describe("GeminiRewriteService (Unit)", () => {
  let service: GeminiRewriteService;
  let generateContentStub: sinon.SinonStub;

  beforeEach(() => {
    service = new GeminiRewriteService(makeConfigService());
    generateContentStub = sinon.stub(
      (service as unknown as { model: { generateContent: sinon.SinonStub } })
        .model,
      "generateContent",
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("success path", () => {
    it("should call generateContent and return trimmed response text", async () => {
      generateContentStub.resolves({
        response: { text: () => "  Fixed text.  " },
      });

      const result = await service.rewrite("helo world", "fix-grammar");

      expect(result).to.equal("Fixed text.");
      expect(generateContentStub.calledOnce).to.equal(true);
    });

    it("should include the input text in the prompt passed to generateContent", async () => {
      generateContentStub.resolves({ response: { text: () => "ok" } });

      await service.rewrite("my draft", "professional");

      const [promptArg] = generateContentStub.firstCall.args;
      expect(promptArg).to.include("my draft");
    });

    it("should use a different prompt for each tone", async () => {
      generateContentStub.resolves({ response: { text: () => "ok" } });

      await service.rewrite("hello", "casual");
      const casualPrompt: string = generateContentStub.firstCall.args[0];

      generateContentStub.reset();
      generateContentStub.resolves({ response: { text: () => "ok" } });

      await service.rewrite("hello", "shorter");
      const shorterPrompt: string = generateContentStub.firstCall.args[0];

      expect(casualPrompt).to.not.equal(shorterPrompt);
    });
  });

  describe("timeout handling", () => {
    it("should throw ServiceUnavailableException when generateContent takes longer than 10 s", async () => {
      const clock = sinon.useFakeTimers();

      generateContentStub.returns(new Promise(() => {}));

      const promise = service.rewrite("test", "fix-grammar");
      await clock.tickAsync(10_001);

      try {
        await promise;
        expect.fail("Should have thrown ServiceUnavailableException");
      } catch (error) {
        expect(error).to.be.instanceOf(ServiceUnavailableException);
      } finally {
        clock.restore();
      }
    });

    it("should NOT throw when generateContent resolves within 10 s", async () => {
      const clock = sinon.useFakeTimers();

      generateContentStub.resolves({
        response: { text: () => "fast response" },
      });

      const promise = service.rewrite("test", "fix-grammar");
      await clock.tickAsync(1_000);
      const result = await promise;

      expect(result).to.equal("fast response");
      clock.restore();
    });
  });
});
