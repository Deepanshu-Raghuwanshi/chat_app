export interface AiSummarizerPort {
  summarize(
    messages: Array<{ role: "me" | "them"; content: string }>,
  ): Promise<string>;
}
