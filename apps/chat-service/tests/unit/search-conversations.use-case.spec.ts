import { expect } from "chai";
import * as sinon from "sinon";
import { SearchConversationsUseCase } from "../../src/application/use-cases/search-conversations.use-case";
import { ConversationParticipantRepository } from "../../src/application/ports/conversation-participant.repository";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { ConversationViewBuilder } from "../../src/application/services/conversation-view.builder";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";
import { ConversationView } from "../../src/application/interfaces/conversation-view.interface";

function makeConversation(id: string): ConversationEntity {
  return ConversationEntity.create({
    id,
    participant1Id: "user1",
    participant2Id: "user2",
    lastActivityAt: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  });
}

function makeView(id: string): ConversationView {
  return {
    id,
    participants: [],
    unreadCount: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("SearchConversationsUseCase (Unit)", () => {
  let useCase: SearchConversationsUseCase;
  let participantRepoMock: Record<string, sinon.SinonStub>;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let viewBuilderMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    participantRepoMock = {
      findConversationIdsByParticipantName: sinon.stub(),
    };
    conversationRepoMock = {
      findByIds: sinon.stub(),
    };
    viewBuilderMock = {
      build: sinon.stub(),
    };

    useCase = new SearchConversationsUseCase(
      participantRepoMock as unknown as ConversationParticipantRepository,
      conversationRepoMock as unknown as ConversationRepository,
      viewBuilderMock as unknown as ConversationViewBuilder,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return a conversation view when participant repo returns one matching ID", async () => {
    const conv = makeConversation("conv1");
    participantRepoMock.findConversationIdsByParticipantName.resolves([
      "conv1",
    ]);
    conversationRepoMock.findByIds.resolves([conv]);
    viewBuilderMock.build.resolves(makeView("conv1"));

    const result = await useCase.execute({ userId: "user1", q: "john" });

    expect(result.data).to.have.length(1);
    expect(result.data[0].id).to.equal("conv1");
    expect(result.hasMore).to.equal(false);
  });

  it("should return { data: [], hasMore: false } immediately when participant repo returns empty array", async () => {
    participantRepoMock.findConversationIdsByParticipantName.resolves([]);

    const result = await useCase.execute({ userId: "user1", q: "nobody" });

    expect(result.data).to.deep.equal([]);
    expect(result.hasMore).to.equal(false);
    expect(conversationRepoMock.findByIds.called).to.equal(false);
  });

  it("should always return hasMore: false regardless of result count", async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `conv${i}`);
    const convs = ids.map((id) => makeConversation(id));
    participantRepoMock.findConversationIdsByParticipantName.resolves(ids);
    conversationRepoMock.findByIds.resolves(convs);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    const result = await useCase.execute({ userId: "user1", q: "test" });

    expect(result.hasMore).to.equal(false);
  });

  it("should call findByIds with exactly the IDs returned by findConversationIdsByParticipantName", async () => {
    const ids = ["conv1", "conv2", "conv3"];
    participantRepoMock.findConversationIdsByParticipantName.resolves(ids);
    conversationRepoMock.findByIds.resolves(
      ids.map((id) => makeConversation(id)),
    );
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    await useCase.execute({ userId: "user1", q: "test" });

    expect(conversationRepoMock.findByIds.calledOnce).to.equal(true);
    expect(conversationRepoMock.findByIds.firstCall.args[0]).to.deep.equal(ids);
  });

  it("should call ConversationViewBuilder.build once per conversation", async () => {
    const ids = ["conv1", "conv2", "conv3"];
    const convs = ids.map((id) => makeConversation(id));
    participantRepoMock.findConversationIdsByParticipantName.resolves(ids);
    conversationRepoMock.findByIds.resolves(convs);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    await useCase.execute({ userId: "user1", q: "test" });

    expect(viewBuilderMock.build.callCount).to.equal(3);
  });

  it("should handle up to 50 results when repo returns 50 IDs", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `conv${i}`);
    const convs = ids.map((id) => makeConversation(id));
    participantRepoMock.findConversationIdsByParticipantName.resolves(ids);
    conversationRepoMock.findByIds.resolves(convs);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    const result = await useCase.execute({ userId: "user1", q: "test" });

    expect(result.data).to.have.length(50);
    expect(result.hasMore).to.equal(false);
  });
});
