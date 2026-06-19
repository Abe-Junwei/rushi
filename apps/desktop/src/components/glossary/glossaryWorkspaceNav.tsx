import type { ReactNode } from "react";
import { PRODUCT_ICON } from "../../config/productIcons";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import type { GlossaryWorkspaceId } from "./glossaryWorkspaceTypes";

export type GlossaryWorkspaceNavItem = {
  id: GlossaryWorkspaceId;
  label: string;
  icon: ReactNode;
};

function navIcon(Icon: typeof PRODUCT_ICON.navGlossaryVocabulary): ReactNode {
  return <Icon className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />;
}

/** 热词与记忆子工作区 — 侧栏子导航唯一真源（勿在页内再叠 segmented toggle）。 */
export const GLOSSARY_WORKSPACE_NAV_ITEMS: GlossaryWorkspaceNavItem[] = [
  {
    id: "vocabulary",
    label: "转写词汇表",
    icon: navIcon(PRODUCT_ICON.navGlossaryVocabulary),
  },
  {
    id: "memory",
    label: "纠错记忆",
    icon: navIcon(PRODUCT_ICON.navGlossaryMemory),
  },
  {
    id: "bundle",
    label: "词表包",
    icon: navIcon(PRODUCT_ICON.navGlossaryBundle),
  },
];
