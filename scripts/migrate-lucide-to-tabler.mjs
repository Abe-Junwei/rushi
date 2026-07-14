/**
 * Codemod: lucide-react → @tabler/icons-react for apps/desktop/src
 * Run: node scripts/migrate-lucide-to-tabler.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../apps/desktop/src");

/** Lucide export name → Tabler export name */
const MAP = {
  AlertCircle: "IconAlertCircle",
  AlertTriangle: "IconAlertTriangle",
  ArrowDownUp: "IconArrowsUpDown",
  BarChart3: "IconChartBar",
  Bell: "IconBell",
  BookMarked: "IconBookmarks",
  BookOpen: "IconBook",
  Bot: "IconRobot",
  Brain: "IconBrain",
  Check: "IconCheck",
  CheckCircle2: "IconCircleCheck",
  ChevronDown: "IconChevronDown",
  ChevronLeft: "IconChevronLeft",
  ChevronRight: "IconChevronRight",
  ChevronUp: "IconChevronUp",
  Circle: "IconCircle",
  CircleAlert: "IconAlertCircle",
  // Keep distinct from Play (productIcons runJob vs playAudio)
  CirclePlay: "IconCircleCaretRight",
  Cloud: "IconCloud",
  Copy: "IconCopy",
  Cpu: "IconCpu",
  Download: "IconDownload",
  ExternalLink: "IconExternalLink",
  FileAudio: "IconFileMusic",
  FileInput: "IconFileUpload",
  FileOutput: "IconFileDownload",
  FileSpreadsheet: "IconFileSpreadsheet",
  FileText: "IconFileText",
  FileUp: "IconFileUpload",
  Flame: "IconFlame",
  FolderOpen: "IconFolderOpen",
  History: "IconHistory",
  Info: "IconInfoCircle",
  Keyboard: "IconKeyboard",
  List: "IconList",
  ListChecks: "IconListCheck",
  ListOrdered: "IconListNumbers",
  ListPlus: "IconList",
  Loader2: "IconLoader2",
  LoaderCircle: "IconLoader",
  MessageSquare: "IconMessage",
  Mic: "IconMicrophone",
  MinusCircle: "IconCircleMinus",
  MoreHorizontal: "IconDots",
  NotebookText: "IconNotebook",
  Palette: "IconPalette",
  PanelLeftOpen: "IconLayoutSidebarLeftExpand",
  Pause: "IconPlayerPause",
  PenLine: "IconEdit",
  Pencil: "IconPencil",
  Play: "IconPlayerPlay",
  Plus: "IconPlus",
  Redo2: "IconArrowForwardUp",
  RefreshCw: "IconRefresh",
  Repeat: "IconRepeat",
  Replace: "IconReplace",
  RotateCcw: "IconRotate",
  Save: "IconDeviceFloppy",
  Search: "IconSearch",
  Settings: "IconSettings",
  SpellCheck2: "IconTextSpellcheck",
  Square: "IconSquare",
  Target: "IconTarget",
  Trash2: "IconTrash",
  TriangleAlert: "IconAlertTriangle",
  Undo2: "IconArrowBackUp",
  Upload: "IconUpload",
  Wand2: "IconWand",
  X: "IconX",
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

function rewriteImportBlock(names) {
  const mapped = [];
  let hasType = false;
  for (const raw of names) {
    let n = raw.trim();
    if (!n) continue;
    const isType = n.startsWith("type ");
    if (isType) n = n.slice(5).trim();
    let local = n;
    let imported = n;
    if (n.includes(" as ")) {
      const [a, b] = n.split(/\s+as\s+/);
      imported = a.trim();
      local = b.trim();
    }
    if (imported === "LucideIcon") {
      hasType = true;
      mapped.push(`type TablerIcon as ${local === "LucideIcon" ? "TablerIcon" : local}`);
      continue;
    }
    const tabler = MAP[imported];
    if (!tabler) {
      throw new Error(`No Tabler mapping for Lucide icon: ${imported}`);
    }
    if (local !== imported) {
      mapped.push(isType ? `type ${tabler} as ${local}` : `${tabler} as ${local}`);
    } else if (isType) {
      mapped.push(`type ${tabler}`);
    } else {
      // Keep local binding name as Lucide name for fewer JSX renames… actually JSX uses the binding.
      // Prefer renaming binding to Tabler name AND updating JSX — harder.
      // Simpler: import { IconCheck as Check } so JSX `<Check />` stays.
      mapped.push(`${tabler} as ${imported}`);
    }
  }
  return { mapped, hasType };
}

let changedFiles = 0;
const unmapped = new Set();

for (const file of walk(ROOT)) {
  let text = readFileSync(file, "utf8");
  if (!text.includes("lucide-react") && !text.includes("LucideIcon")) continue;

  const importRe = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/gs;
  let next = text;
  let match;
  const replacements = [];
  while ((match = importRe.exec(text))) {
    const names = match[1].split(",");
    try {
      const { mapped } = rewriteImportBlock(names);
      const body = mapped.join(",\n  ");
      const stmt = `import {\n  ${body},\n} from "@tabler/icons-react";`;
      replacements.push({ from: match[0], to: stmt });
    } catch (e) {
      console.error(file, e.message);
      process.exitCode = 1;
      continue;
    }
  }

  for (const { from, to } of replacements) {
    next = next.replace(from, to);
  }

  // Standalone type-only imports
  next = next.replace(
    /import\s+type\s*\{\s*LucideIcon\s*\}\s*from\s*["']lucide-react["'];?/g,
    'import type { TablerIcon } from "@tabler/icons-react";',
  );
  next = next.replace(/\bLucideIcon\b/g, "TablerIcon");

  if (next !== text) {
    writeFileSync(file, next);
    changedFiles += 1;
    console.log("updated", file.replace(ROOT + "/", ""));
  }
}

console.log(`\nDone. files=${changedFiles}`);
if (unmapped.size) console.log("unmapped", [...unmapped]);
