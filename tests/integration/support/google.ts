import { http, HttpResponse } from "msw";

/** The Google account the mocked token endpoint signs in as. Tests change it. */
export const googleAccount = {
  sub: "google-user-1",
  email: "amina@example.com",
  email_verified: true,
  name: "Amina Benali",
};

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Google's token endpoint: returns an ID token for `googleAccount`. */
export const googleTokenHandler = http.post("https://oauth2.googleapis.com/token", () =>
  HttpResponse.json({
    access_token: "google-access-token",
    token_type: "Bearer",
    expires_in: 3600,
    scope: "openid email profile",
    id_token: [
      base64url({ alg: "RS256", typ: "JWT" }),
      base64url({
        ...googleAccount,
        iss: "https://accounts.google.com",
        aud: "test-google-client-id",
        iat: 0,
        exp: 4102444800,
      }),
      "signature",
    ].join("."),
  }),
);
