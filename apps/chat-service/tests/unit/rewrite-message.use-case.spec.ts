import { expect } from "chai";
import * as sinon from "sinon";
import { BadRequestException } from "@nestjs/common";
import { RewriteMessageUseCase } from "../../src/application/use-cases/rewrite-message.use-case";
import {
  AiRewriterPort,
  RewriteTone,
} from "../../src/application/ports/ai-rewriter.port";

describe("RewriteMessageUseCase (Unit)", () => {
  let useCase: RewriteMessageUseCase;
  let aiRewriterMock: { rewrite: sinon.SinonStub };

  beforeEach(() => {
    aiRewriterMock = { rewrite: sinon.stub() };
    useCase = new RewriteMessageUseCase(
      aiRewriterMock as unknown as AiRewriterPort,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("success path", () => {
    it("should call aiRewriter.rewrite with trimmed text and return { rewrittenText }", async () => {
      aiRewriterMock.rewrite.resolves("corrected text");

      const result = await useCase.execute({
        userId: "user1",
        text: "  hello world  ",
        tone: "fix-grammar",
      });

      expect(result).to.deep.equal({ rewrittenText: "corrected text" });
      expect(aiRewriterMock.rewrite.calledOnce).to.equal(true);
      const [textArg, toneArg] = aiRewriterMock.rewrite.firstCall.args;
      expect(textArg).to.equal("hello world");
      expect(toneArg).to.equal("fix-grammar");
    });

    it("should return whatever string the port returns without further transformation", async () => {
      const rawOutput = "Some   weirdly   formatted   output";
      aiRewriterMock.rewrite.resolves(rawOutput);

      const result = await useCase.execute({
        userId: "u1",
        text: "hi",
        tone: "longer",
      });

      expect(result.rewrittenText).to.equal(rawOutput);
    });

    const tones: RewriteTone[] = [
      "fix-grammar",
      "professional",
      "casual",
      "shorter",
      "longer",
    ];
    for (const tone of tones) {
      it(`should pass tone "${tone}" through to the port unchanged`, async () => {
        aiRewriterMock.rewrite.resolves("result");

        await useCase.execute({ userId: "u1", text: "some text", tone });

        expect(aiRewriterMock.rewrite.firstCall.args[1]).to.equal(tone);
      });
    }
  });

  describe("failure paths", () => {
    it("should throw BadRequestException when text is empty string", async () => {
      try {
        await useCase.execute({ userId: "u1", text: "", tone: "casual" });
        expect.fail("Should have thrown BadRequestException");
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });

    it("should throw BadRequestException when text is only whitespace", async () => {
      try {
        await useCase.execute({ userId: "u1", text: "   ", tone: "casual" });
        expect.fail("Should have thrown BadRequestException");
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });

    it("should NOT call aiRewriter.rewrite when text is empty", async () => {
      try {
        await useCase.execute({ userId: "u1", text: "", tone: "casual" });
      } catch {
        // expected
      }
      expect(aiRewriterMock.rewrite.called).to.equal(false);
    });

    it("should NOT call aiRewriter.rewrite when text is only whitespace", async () => {
      try {
        await useCase.execute({ userId: "u1", text: "   ", tone: "casual" });
      } catch {
        // expected
      }
      expect(aiRewriterMock.rewrite.called).to.equal(false);
    });

    it("should propagate errors thrown by the AI port", async () => {
      const portError = new Error("Gemini unavailable");
      aiRewriterMock.rewrite.rejects(portError);

      try {
        await useCase.execute({
          userId: "u1",
          text: "hello",
          tone: "professional",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).to.equal(portError);
      }
    });
  });
});
