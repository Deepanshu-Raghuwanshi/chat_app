import { expect } from "chai";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AiSummarizeDto } from "../../src/application/dto/ai-summarize.dto";

function makeDto(data: Record<string, unknown>): AiSummarizeDto {
  return plainToInstance(AiSummarizeDto, data);
}

describe("AiSummarizeDto (Unit)", () => {
  describe("valid inputs", () => {
    it("should pass with a valid UUID and no limit", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
      });
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });

    it("should pass with a valid UUID and limit = 1 (lower boundary)", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 1,
      });
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });

    it("should pass with a valid UUID and limit = 50 (default value)", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 50,
      });
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });

    it("should pass with a valid UUID and limit = 100 (upper boundary)", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 100,
      });
      const errors = await validate(dto);
      expect(errors).to.have.length(0);
    });
  });

  describe("invalid conversationId", () => {
    it("should fail when conversationId is not a UUID", async () => {
      const dto = makeDto({ conversationId: "not-a-uuid" });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "conversationId");
      expect(field).to.not.equal(undefined);
    });

    it("should fail when conversationId is missing", async () => {
      const dto = makeDto({});
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "conversationId");
      expect(field).to.not.equal(undefined);
    });

    it("should fail when conversationId is an empty string", async () => {
      const dto = makeDto({ conversationId: "" });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "conversationId");
      expect(field).to.not.equal(undefined);
    });
  });

  describe("invalid limit", () => {
    it("should fail when limit is 0 (below minimum)", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 0,
      });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "limit");
      expect(field).to.not.equal(undefined);
    });

    it("should fail when limit is 101 (above maximum)", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 101,
      });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "limit");
      expect(field).to.not.equal(undefined);
    });

    it("should fail when limit is a float", async () => {
      const dto = makeDto({
        conversationId: "123e4567-e89b-12d3-a456-426614174000",
        limit: 10.5,
      });
      const errors = await validate(dto);
      const field = errors.find((e) => e.property === "limit");
      expect(field).to.not.equal(undefined);
    });
  });
});
