import type { Ai } from "@cloudflare/workers-types";
import type { ModelAdapter, ModelRequest } from "./plugins";

type TextGenerationResponse = { response?: string };

export class WorkersAiAdapter implements ModelAdapter {
  readonly id = "cloudflare-workers-ai";

  constructor(
    private readonly ai: Ai,
    private readonly model: string
  ) {}

  async generate(request: ModelRequest): Promise<string> {
    const result = (await this.ai.run(this.model as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: request.system },
        {
          role: "user",
          content: JSON.stringify({
            instruction: request.envelope.body,
            correlationId: request.envelope.correlationId,
            turn: request.envelope.turn,
            transcript: request.transcript
          })
        }
      ]
    } as never)) as TextGenerationResponse;

    if (!result.response?.trim()) throw new Error("MODEL_EMPTY_RESPONSE");
    return result.response.trim();
  }
}
