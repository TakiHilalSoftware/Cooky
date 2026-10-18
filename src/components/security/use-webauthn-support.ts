"use client";

import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/** Passkey support is a browser fact: false during server render, the real value after. */
export function useWebAuthnSupport(): boolean {
  return useSyncExternalStore(subscribeNever, browserSupportsWebAuthn, () => false);
}
