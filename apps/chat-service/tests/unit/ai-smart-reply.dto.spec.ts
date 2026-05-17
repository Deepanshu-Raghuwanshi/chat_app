import { expect } from "chai";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AiSmartReplyDto } from "../../src/application/dto/ai-smart-reply.dto";

function makeDto(messages: unknown[]): AiSmartReplyDto {
  return plainToInstance(AiSmartReplyDto, { messages });
}

describe("AiSmartReplyDto — LastMessageIsFromThem constraint (Unit)", () => {
  describe("valid inputs", () => {
    it("should pass when the last message has role 'them'", async () => {
      const dto = makeDto([{ role: "them", content: "Are you free?" }]);
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });

    it("should pass when multiple messages end with role 'them'", async () => {
      const dto = makeDto([
        { role: "me", content: "Hey" },
        { role: "them", content: "Hi there" },
        { role: "them", content: "Are you free this weekend?" },
      ]);
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });

    it("should pass when messages alternate and last is 'them'", async () => {
      const dto = makeDto([
        { role: "me", content: "Hello" },
        { role: "them", content: "Hey!" },
      ]);
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });
  });

  describe("constraint violation", () => {
    it("should fail when the last message has role 'me'", async () => {
      const dto = makeDto([
        { role: "them", content: "Are you free?" },
        { role: "me", content: "Yes I am" },
      ]);
      const errors = await validate(dto);
      const messagesError = errors.find((e) => e.property === "messages");
      expect(messagesError).to.not.equal(undefined);
      const constraints = Object.values(messagesError!.constraints ?? {});
      expect(constraints.some((c) => c.includes('"them"'))).to.equal(true);
    });

    it("should fail when a single message has role 'me'", async () => {
      const dto = makeDto([{ role: "me", content: "I said something" }]);
      const errors = await validate(dto);
      const messagesError = errors.find((e) => e.property === "messages");
      expect(messagesError).to.not.equal(undefined);
    });
  });
});
