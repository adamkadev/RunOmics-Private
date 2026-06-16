// Core provider-agnostic abstraction. A provider does one thing: take a system
// prompt, a user prompt and a JSON schema, and return parsed JSON. Each feature
// (insights, training plan) builds its own request and validates the result -
// so adding a feature never touches the providers.

export interface LLMCompletionRequest {
  systemPrompt: string
  userPrompt: string
  // JSON schema for providers with native structured output (Gemini
  // responseSchema, OpenAI json_schema). Kept to the subset all providers
  // accept: no "additionalProperties", no free-form maps.
  schema: object
  temperature?: number
}

export interface LLMProvider {
  readonly name: string
  // Returns the model's JSON response, loosely parsed (unknown). Callers
  // validate it against their own contract. Throws on transport failure.
  complete(request: LLMCompletionRequest): Promise<unknown>
}
