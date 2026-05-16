export interface AiSmartReplierPort {
  generateReplies(
    messages: Array<{ role: "me" | "them"; content: string }>,
  ): Promise<string[]>;
}
