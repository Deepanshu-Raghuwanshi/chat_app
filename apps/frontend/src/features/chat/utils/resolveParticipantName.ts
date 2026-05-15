import type { ConversationParticipant } from "@shared-types";

export const resolveParticipantName = (
  userId: string,
  participants: ConversationParticipant[],
): string => participants.find((p) => p.userId === userId)?.username ?? userId;
