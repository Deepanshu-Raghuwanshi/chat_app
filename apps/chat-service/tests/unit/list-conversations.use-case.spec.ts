import { expect } from "chai";
import * as sinon from "sinon";
import { ListConversationsUseCase } from "../../src/application/use-cases/list-conversations.use-case";
import { ConversationRepository } from "../../src/application/ports/conversation.repository";
import { FriendshipVerifier } from "../../src/application/ports/friendship-verifier.port";
import { ConversationViewBuilder } from "../../src/application/services/conversation-view.builder";
import { ConversationEntity } from "../../src/domain/entities/conversation.entity";

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

function makeView(id: string) {
  return {
    id,
    participants: [],
    unreadCount: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("ListConversationsUseCase (Unit)", () => {
  let useCase: ListConversationsUseCase;
  let conversationRepoMock: Record<string, sinon.SinonStub>;
  let friendshipVerifierMock: Record<string, sinon.SinonStub>;
  let viewBuilderMock: Record<string, sinon.SinonStub>;

  beforeEach(() => {
    conversationRepoMock = {
      findByUserId: sinon.stub(),
    };
    friendshipVerifierMock = {
      areFriends: sinon.stub().resolves(true),
    };
    viewBuilderMock = {
      build: sinon.stub(),
    };

    useCase = new ListConversationsUseCase(
      conversationRepoMock as unknown as ConversationRepository,
      friendshipVerifierMock as unknown as FriendshipVerifier,
      viewBuilderMock as unknown as ConversationViewBuilder,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should include correct unreadCount per conversation", async () => {
    const conv = makeConversation("conv1");
    conversationRepoMock.findByUserId.resolves([conv]);
    viewBuilderMock.build.resolves({ ...makeView("conv1"), unreadCount: 5 });

    const result = await useCase.execute({ userId: "user1", limit: 20 });

    expect(result.data).to.have.length(1);
    expect(result.data[0].unreadCount).to.equal(5);
    expect(viewBuilderMock.build.calledOnce).to.equal(true);
  });

  it("should return hasMore: true and set nextCursor when a full page is returned", async () => {
    const conversations = Array.from({ length: 21 }, (_, i) =>
      makeConversation(`conv${i}`),
    );
    conversationRepoMock.findByUserId.resolves(conversations);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    const result = await useCase.execute({ userId: "user1", limit: 20 });

    expect(result.hasMore).to.equal(true);
    expect(result.data).to.have.length(20);
    expect(result.nextCursor).to.equal("conv19");
  });

  it("should return hasMore: false when fewer items than the limit are returned", async () => {
    conversationRepoMock.findByUserId.resolves([
      makeConversation("conv1"),
      makeConversation("conv2"),
    ]);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    const result = await useCase.execute({ userId: "user1", limit: 20 });

    expect(result.hasMore).to.equal(false);
    expect(result.nextCursor).to.equal(undefined);
  });

  it("should exclude conversations with unfriended users — regression for post-unfriend visibility bug", async () => {
    conversationRepoMock.findByUserId.resolves([
      makeConversation("conv1"),
      makeConversation("conv2"),
    ]);
    // conv1 still friends, conv2 unfriended
    friendshipVerifierMock.areFriends
      .onFirstCall()
      .resolves(true)
      .onSecondCall()
      .resolves(false);
    viewBuilderMock.build.callsFake((conv: ConversationEntity) =>
      Promise.resolve(makeView(conv.id)),
    );

    const result = await useCase.execute({ userId: "user1", limit: 20 });

    expect(result.data).to.have.length(1);
    expect(result.data[0].id).to.equal("conv1");
  });
});
