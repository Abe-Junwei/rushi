import { removeCspScopeRules, readCspScopeRules, upsertCspScopeRules } from "./cspNonceStyleRegistry";

export const CSP_LAYOUT_ID_ATTR = "data-csp-layout-id";

export const CSP_LAYOUT_OWNER_REACT = "react";
export const CSP_LAYOUT_OWNER_IMPERATIVE = "imperative";

const LAYOUT_OWNER_MERGE_ORDER = [CSP_LAYOUT_OWNER_REACT, CSP_LAYOUT_OWNER_IMPERATIVE];

const UNITLESS_CSS_PROPS = new Set([
  "opacity",
  "zIndex",
  "fontWeight",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
]);

export type CspLayoutRules = Record<string, string | number | null | undefined>;

/** Per-element layout slots so React and imperative updates do not clobber each other. */
const elementLayoutOwners = new WeakMap<HTMLElement, Map<string, CspLayoutRules>>();

function toKebabProp(prop: string): string {
  if (prop.startsWith("--")) return prop;
  return prop.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function formatCssValue(prop: string, value: string | number): string {
  if (typeof value === "number" && !UNITLESS_CSS_PROPS.has(prop)) {
    return `${value}px`;
  }
  return String(value);
}

export function formatCspLayoutDeclarations(rules: CspLayoutRules): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(rules)) {
    if (value == null || value === "") continue;
    parts.push(`${toKebabProp(key)}: ${formatCssValue(key, value)}`);
  }
  return parts.join("; ");
}

export function ensureCspLayoutId(element: HTMLElement): string {
  const existing = element.getAttribute(CSP_LAYOUT_ID_ATTR);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `csp-${Math.random().toString(36).slice(2)}`;
  element.setAttribute(CSP_LAYOUT_ID_ATTR, id);
  return id;
}

function layoutScopeId(element: HTMLElement): string {
  return `layout-${ensureCspLayoutId(element)}`;
}

function removeLayoutScope(element: HTMLElement): void {
  const layoutId = element.getAttribute(CSP_LAYOUT_ID_ATTR);
  if (layoutId) removeCspScopeRules(`layout-${layoutId}`);
}

function mergeOwnerSlots(owners: Map<string, CspLayoutRules>): CspLayoutRules {
  const merged: CspLayoutRules = {};
  const seen = new Set<string>();
  for (const owner of LAYOUT_OWNER_MERGE_ORDER) {
    const slot = owners.get(owner);
    if (!slot) continue;
    Object.assign(merged, slot);
    seen.add(owner);
  }
  for (const [owner, slot] of owners) {
    if (seen.has(owner)) continue;
    Object.assign(merged, slot);
  }
  return merged;
}

function flushElementLayoutRules(element: HTMLElement): void {
  const owners = elementLayoutOwners.get(element);
  if (!owners || owners.size === 0) {
    elementLayoutOwners.delete(element);
    removeLayoutScope(element);
    return;
  }
  const declarations = formatCspLayoutDeclarations(mergeOwnerSlots(owners));
  if (!declarations) {
    elementLayoutOwners.delete(element);
    removeLayoutScope(element);
    return;
  }
  const layoutId = ensureCspLayoutId(element);
  upsertCspScopeRules(
    layoutScopeId(element),
    `[${CSP_LAYOUT_ID_ATTR}="${layoutId}"] { ${declarations} }`,
  );
}

function mergeRulesIntoSlot(
  slot: CspLayoutRules,
  rules: CspLayoutRules,
): CspLayoutRules {
  const next = { ...slot };
  for (const [key, value] of Object.entries(rules)) {
    if (value == null || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** Apply per-element layout via nonce `<style>` (replaces inline `style=` / `.style`). */
export function setCspLayoutRules(
  element: HTMLElement,
  rules: CspLayoutRules,
  owner: string = CSP_LAYOUT_OWNER_IMPERATIVE,
): void {
  let owners = elementLayoutOwners.get(element);
  if (!owners) {
    owners = new Map();
    elementLayoutOwners.set(element, owners);
  }
  const nextSlot = mergeRulesIntoSlot(owners.get(owner) ?? {}, rules);
  if (Object.keys(nextSlot).length === 0) {
    owners.delete(owner);
    if (owners.size === 0) elementLayoutOwners.delete(element);
  } else {
    owners.set(owner, nextSlot);
  }
  flushElementLayoutRules(element);
}

export function clearCspLayoutRules(element: HTMLElement, owner?: string): void {
  if (owner) {
    const owners = elementLayoutOwners.get(element);
    if (!owners) return;
    owners.delete(owner);
    if (owners.size === 0) elementLayoutOwners.delete(element);
    flushElementLayoutRules(element);
    return;
  }
  elementLayoutOwners.delete(element);
  removeLayoutScope(element);
}

export function readCspLayoutRulesForElement(element: HTMLElement): string | undefined {
  const layoutId = element.getAttribute(CSP_LAYOUT_ID_ATTR);
  if (!layoutId) return undefined;
  return readCspScopeRules(`layout-${layoutId}`);
}
