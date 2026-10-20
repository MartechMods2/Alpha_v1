// Only explicitly authored user messages may cross the chat boundary.
export class AuraUserError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuraUserError";
  }
}
export function publicAuraError(error, fallback) {
  return error instanceof AuraUserError ? error.message : fallback;
}
