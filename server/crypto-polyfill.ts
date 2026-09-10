import { webcrypto } from "node:crypto";

const g = globalThis as typeof globalThis & { crypto?: Crypto };
if (typeof g.crypto?.getRandomValues !== "function") {
  Object.defineProperty(g, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
