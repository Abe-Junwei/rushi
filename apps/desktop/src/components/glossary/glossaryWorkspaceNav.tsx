import type { ReactNode } from "react";
import { BookOpen, FileSpreadsheet, Sparkles } from "lucide-react";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import type { GlossaryWorkspaceId } from "./glossaryWorkspaceTypes";

export type GlossaryWorkspaceNavItem = {
  id: GlossaryWorkspaceId;
  label: string;
  icon: ReactNode;
};

export const GLOSSARY_WORKSPACE_NAV_ITEMS: GlossaryWorkspaceNavItem[] = [
  {
    id: "vocabulary",
    label: "转写词汇表",
    icon: <BookOpen className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  },
  {
    id: "memory",
    label: "纠错记忆",
    icon: <Sparkles className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  },
  {
    id: "bundle",
    label: "词表包",
    icon: <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
  },
];
