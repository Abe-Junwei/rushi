import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { GLOSSARY_LIST_EDIT_HINT } from "./glossaryPanelStyles";

type Props = {
  children: string;
};

export function GlossaryListEditHint({ children }: Props) {
  return (
    <p className={`m-0 ${GLOSSARY_LIST_EDIT_HINT} ${PANEL_TYPOGRAPHY.meta}`}>{children}</p>
  );
}
