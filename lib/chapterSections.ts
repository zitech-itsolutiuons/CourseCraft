export type ChapterSection = {
  id: string;
  title: string;
  contentMd: string;
};

function sectionId(index: number, title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `section-${index + 1}-${slug || "content"}`;
}

export function parseChapterSections(contentMd: string): ChapterSection[] {
  const sections: Omit<ChapterSection, "id">[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let preamble: string[] = [];
  let fence: string | null = null;

  const saveCurrent = () => {
    if (current) sections.push({ title: current.title, contentMd: current.lines.join("\n").trim() });
  };

  for (const line of contentMd.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
    }

    const heading = !fence ? line.match(/^#{2,3}\s+(.+?)\s*#*\s*$/) : null;
    if (heading) {
      saveCurrent();
      current = { title: heading[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  saveCurrent();

  const introduction = preamble.join("\n").trim();
  if (introduction) sections.unshift({ title: sections.length ? "Introduction" : "Chapter content", contentMd: introduction });
  if (!sections.length) sections.push({ title: "Chapter content", contentMd: "" });

  return sections.map((section, index) => ({
    ...section,
    id: sectionId(index, section.title),
  }));
}
