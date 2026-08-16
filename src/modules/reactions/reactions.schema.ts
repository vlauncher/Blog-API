import { z } from "zod";

export const reactionTypeEnum = z.enum(["LIKE", "CLAP", "LOVE", "INSIGHTFUL", "CELEBRATE"]);

export const toggleReactionSchema = z.object({
  type: reactionTypeEnum.default("LIKE"),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
