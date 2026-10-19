import { http, HttpResponse } from "msw";

/**
 * A tiny Groq: just the endpoints Cooky calls. Tests set what the next
 * transcription returns (or a failure) and read what was sent.
 */
export const fakeGroq = {
  transcript: "" as string,
  failWith: null as number | null,
  requests: [] as FormData[],
  /** What the chat model answers (the structured JSON Cooky asks for). */
  answer: { reply: "", picks: [] } as Record<string, unknown>,
  chatFailWith: null as number | null,
  chatRequests: [] as { model: string; messages: { role: string; content: string }[] }[],
  reset() {
    this.transcript = "";
    this.failWith = null;
    this.requests = [];
    this.answer = { reply: "", picks: [] };
    this.chatFailWith = null;
    this.chatRequests = [];
  },
};

export const aiHandlers = [
  http.post("https://api.groq.com/openai/v1/chat/completions", async ({ request }) => {
    fakeGroq.chatRequests.push((await request.json()) as (typeof fakeGroq.chatRequests)[number]);
    if (fakeGroq.chatFailWith) {
      return HttpResponse.json({ error: { message: "upstream failure" } }, { status: fakeGroq.chatFailWith });
    }
    return HttpResponse.json({
      id: "chatcmpl_1",
      object: "chat.completion",
      created: 1_760_000_000,
      model: "openai/gpt-oss-120b",
      choices: [
        { index: 0, message: { role: "assistant", content: JSON.stringify(fakeGroq.answer) }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 812, completion_tokens: 64, total_tokens: 876 },
    });
  }),
  http.post("https://api.groq.com/openai/v1/audio/transcriptions", async ({ request }) => {
    fakeGroq.requests.push(await request.formData());
    if (fakeGroq.failWith) {
      return HttpResponse.json({ error: { message: "upstream failure" } }, { status: fakeGroq.failWith });
    }
    return HttpResponse.json({ text: fakeGroq.transcript, x_groq: { id: "req_1" } });
  }),
];
