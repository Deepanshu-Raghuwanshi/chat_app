export type RewriteTone =
  | "fix-grammar"
  | "professional"
  | "casual"
  | "shorter"
  | "longer";

export interface AiRewriterPort {
  rewrite(text: string, tone: RewriteTone): Promise<string>;
}
