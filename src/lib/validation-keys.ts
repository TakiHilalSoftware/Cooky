/**
 * Every message key an input schema may produce. Each must exist under
 * `validation.*` in all three catalogs (enforced by a test).
 */
export const VALIDATION_KEYS = [
  "emailInvalid",
  "emailTooLong",
  "nameRequired",
  "nameTooLong",
  "passwordRequired",
  "passwordTooShort",
  "passwordTooLong",
  "acceptTermsRequired",
  "codeFormat",
  "backupCodeFormat",
  "passkeyNameRequired",
  "passkeyNameTooLong",
  "dishNameRequired",
  "dishNameTooLong",
  "servingsRange",
  "ingredientsRequired",
  "tooManyIngredients",
  "ingredientNameRequired",
  "ingredientNameTooLong",
  "ingredientNoteTooLong",
  "amountInvalid",
  "tooManySteps",
  "stepTextRequired",
  "stepTextTooLong",
  "timerInvalid",
  "nutritionInvalid",
  "noteTooLong",
  "duplicate",
  "collectionNameRequired",
  "collectionNameTooLong",
  "cityTooLong",
  "messageRequired",
  "messageTooLong",
  "invalidDate",
  "eventNameRequired",
  "eventNameTooLong",
  "guestsRange",
  "searchTooShort",
  "groupNameRequired",
  "groupNameTooLong",
  "reportDetailsTooLong",
] as const;

export type ValidationKey = (typeof VALIDATION_KEYS)[number];

export function isValidationKey(value: unknown): value is ValidationKey {
  return typeof value === "string" && (VALIDATION_KEYS as readonly string[]).includes(value);
}
