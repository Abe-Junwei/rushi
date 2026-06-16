import { createStore } from "zustand/vanilla";

/** Shared vanilla Zustand factory for module-level stores (no React Provider). */
export function createModuleStore<TState>(initializer: () => TState) {
  return createStore<TState>(initializer);
}
