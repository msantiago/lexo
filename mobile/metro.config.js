const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const sharedRoot = path.resolve(repoRoot, "shared");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Allow importing the existing Lexo shared package from the repo root.
config.watchFolders = [sharedRoot];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@shared": sharedRoot,
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let request = moduleName;

  if (request.startsWith("@shared/") || request === "@shared") {
    const rest = request === "@shared" ? "index" : request.slice("@shared/".length);
    request = path.resolve(sharedRoot, rest);
  }

  // shared/ uses ESM-style imports with explicit .ts extensions (Vite-friendly).
  if (request.endsWith(".ts") || request.endsWith(".tsx")) {
    request = request.replace(/\.tsx?$/, "");
  }

  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, request, platform);
  }
  return context.resolveRequest(context, request, platform);
};

module.exports = config;
