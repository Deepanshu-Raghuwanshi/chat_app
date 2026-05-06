export interface FriendshipVerifier {
  areFriends(userId1: string, userId2: string): Promise<boolean>;
}
