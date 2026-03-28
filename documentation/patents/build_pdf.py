#!/usr/bin/env python3
"""Combine all patent disclosures into a single PDF with intro page using fpdf2."""

import re
from fpdf import FPDF
from pathlib import Path

PATENTS_DIR = Path(__file__).parent
OUTPUT = PATENTS_DIR / "Overyonder_Patent_Provisional_v1.pdf"

PATENT_FILES = [
    "patent-1-genome-extraction.md",
    "patent-2-video-genome-extraction.md",
    "patent-3-genome-translation-recipes.md",
    "patent-4-doc-genome-extraction.md",
    "patent-5-customer-ip-extraction.md",
    "patent-6-progressive-context-hydration.md",
    "patent-7-orchestration-control-plane.md",
    "patent-8-incremental-migration.md",
]


BULLET = "-"  # ASCII bullet to avoid unicode issues


class PatentPDF(FPDF):
    def __init__(self):
        super().__init__(format="letter")
        self.set_auto_page_break(auto=True, margin=25)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, "CONFIDENTIAL - Provisional Patent Application", align="C")
        self.cell(0, 10, f"Page {self.page_no()}", align="R")

    def add_intro_page(self):
        self.add_page()
        self.ln(80)

        self.set_font("Helvetica", "B", 22)
        self.multi_cell(0, 12, "System and Method for\nEnterprise Application Portability", align="C")
        self.ln(8)

        self.set_font("Helvetica", "I", 13)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, "Provisional Patent Application", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(8)

        self.set_draw_color(180, 180, 180)
        self.line(25, self.get_y(), 190, self.get_y())
        self.ln(10)

        self.set_font("Helvetica", "", 11)
        self.multi_cell(0, 7, "This provisional application describes a system for:", align="L")
        self.ln(3)

        bullets = [
            "Extracting application genomes from enterprise systems and documents",
            "Representing applications as canonical, platform-neutral models",
            "Orchestrating transformation workflows using hybrid AI and deterministic pipelines",
            "Enabling incremental migration and cross-platform reconstruction",
            "Optimizing AI-driven transformation through context hydration and reusable transformation recipes",
        ]
        self.set_x(35)
        for b in bullets:
            x = self.get_x()
            self.set_x(35)
            self.set_font("Helvetica", "", 11)
            self.cell(5, 7, BULLET)
            self.multi_cell(145, 7, b)
            self.ln(1)

        self.ln(8)
        self.set_x(25)
        self.set_font("Helvetica", "", 11)
        self.cell(0, 7, "The invention establishes a new category of software:", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 10, "Enterprise Application Portability.", align="C", new_x="LMARGIN", new_y="NEXT")

        self.ln(10)
        self.line(25, self.get_y(), 190, self.get_y())
        self.ln(20)

        self.set_font("Helvetica", "", 12)
        self.set_text_color(60, 60, 60)
        self.cell(0, 8, "OverYonder, Inc.", align="C")
        self.set_text_color(0, 0, 0)

    def render_markdown(self, text):
        """Render markdown text to PDF with basic formatting."""
        lines = text.split("\n")
        in_code_block = False
        in_table = False
        table_rows = []
        code_lines = []

        i = 0
        while i < len(lines):
            line = lines[i]

            # Code blocks
            if line.strip().startswith("```"):
                if in_code_block:
                    self._render_code_block(code_lines)
                    code_lines = []
                    in_code_block = False
                else:
                    if in_table:
                        self._render_table(table_rows)
                        table_rows = []
                        in_table = False
                    in_code_block = True
                i += 1
                continue

            if in_code_block:
                code_lines.append(line)
                i += 1
                continue

            # Tables
            if "|" in line and line.strip().startswith("|"):
                if not in_table:
                    in_table = True
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                # Skip separator rows
                if all(re.match(r"^[-:]+$", c) for c in cells):
                    i += 1
                    continue
                table_rows.append(cells)
                i += 1
                continue
            elif in_table:
                self._render_table(table_rows)
                table_rows = []
                in_table = False

            stripped = line.strip()

            # Empty lines
            if not stripped:
                self.ln(3)
                i += 1
                continue

            # Horizontal rules
            if stripped in ("---", "***", "___"):
                self.ln(3)
                self.set_draw_color(200, 200, 200)
                self.line(25, self.get_y(), 190, self.get_y())
                self.ln(5)
                i += 1
                continue

            # Headers
            if stripped.startswith("#"):
                level = len(stripped.split(" ")[0])
                header_text = stripped.lstrip("#").strip()
                header_text = self._strip_md_formatting(header_text)

                if level == 1:
                    self.ln(8)
                    self.set_font("Helvetica", "B", 15)
                    self.multi_cell(0, 8, header_text)
                    self.set_draw_color(60, 60, 60)
                    self.line(25, self.get_y(), 190, self.get_y())
                    self.ln(4)
                elif level == 2:
                    self.ln(6)
                    self.set_font("Helvetica", "B", 13)
                    self.multi_cell(0, 7, header_text)
                    self.set_draw_color(200, 200, 200)
                    self.line(25, self.get_y(), 190, self.get_y())
                    self.ln(3)
                elif level == 3:
                    self.ln(4)
                    self.set_font("Helvetica", "B", 11)
                    self.multi_cell(0, 7, header_text)
                    self.ln(2)
                elif level >= 4:
                    self.ln(3)
                    self.set_font("Helvetica", "BI", 10)
                    self.multi_cell(0, 6, header_text)
                    self.ln(2)

                i += 1
                continue

            # Bullet points
            if re.match(r"^\s*[-*]\s", stripped):
                indent = len(line) - len(line.lstrip())
                bullet_text = re.sub(r"^\s*[-*]\s+", "", line).strip()
                bullet_text = self._strip_md_formatting(bullet_text)

                x_offset = 30 + (indent // 2) * 5
                self.set_x(x_offset)
                self.set_font("Helvetica", "", 10)
                self.cell(5, 6, BULLET)
                self._write_rich_line(bullet_text, width=185 - x_offset - 5)
                self.ln(2)
                i += 1
                continue

            # Numbered lists
            if re.match(r"^\s*\d+[.)]\s", stripped):
                indent = len(line) - len(line.lstrip())
                m = re.match(r"^\s*(\d+[.)]\s+)(.*)", line)
                num = m.group(1).strip()
                body = self._strip_md_formatting(m.group(2).strip())

                x_offset = 30 + (indent // 2) * 5
                self.set_x(x_offset)
                self.set_font("Helvetica", "", 10)
                self.cell(10, 6, num)
                self._write_rich_line(body, width=185 - x_offset - 10)
                self.ln(2)
                i += 1
                continue

            # Regular paragraph text
            clean = self._strip_md_formatting(stripped)
            self.set_font("Helvetica", "", 10)
            self._write_rich_line(clean)
            self.ln(2)
            i += 1

        # Flush remaining
        if in_table and table_rows:
            self._render_table(table_rows)
        if in_code_block and code_lines:
            self._render_code_block(code_lines)

    def _strip_md_formatting(self, text):
        """Remove markdown formatting markers for plain text rendering."""
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"__(.+?)__", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"_(.+?)_", r"\1", text)
        text = re.sub(r"`(.+?)`", r"\1", text)
        text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
        return self._sanitize(text)

    @staticmethod
    def _sanitize(text):
        """Replace unicode chars that latin-1 fonts can't render."""
        replacements = {
            "\u2014": "--",   # em-dash
            "\u2013": "-",    # en-dash
            "\u2018": "'",    # left single quote
            "\u2019": "'",    # right single quote
            "\u201c": '"',    # left double quote
            "\u201d": '"',    # right double quote
            "\u2022": "-",    # bullet
            "\u2026": "...",  # ellipsis
            "\u2192": "->",   # right arrow
            "\u2190": "<-",   # left arrow
            "\u2194": "<->",  # bidirectional arrow
            "\u2195": "<->",  # up-down arrow
            "\u21d2": "=>",   # double right arrow
            "\u2248": "~=",   # approximately
            "\u2265": ">=",   # >=
            "\u2264": "<=",   # <=
            "\u00d7": "x",    # multiplication sign
            "\u2713": "[x]",  # check mark
            "\u2717": "[ ]",  # ballot x
            "\u221e": "inf",  # infinity
            "\u2502": "|",    # box drawing vertical
            "\u250c": "+",    # box drawing corner
            "\u2510": "+",
            "\u2514": "+",
            "\u2518": "+",
            "\u251c": "+",
            "\u2524": "+",
            "\u252c": "+",
            "\u2534": "+",
            "\u253c": "+",
            "\u2500": "-",    # box drawing horizontal
            "\u2550": "=",    # box drawing double horizontal
            "\u2551": "|",    # box drawing double vertical
            "\u255e": "+",
            "\u2561": "+",
            "\u2554": "+",
            "\u2557": "+",
            "\u255a": "+",
            "\u255d": "+",
            "\u2560": "+",
            "\u2563": "+",
            "\u2566": "+",
            "\u2569": "+",
            "\u256c": "+",
            "\u2191": "^",    # up arrow
            "\u2193": "v",    # down arrow
            "\u21e8": "=>",
            "\u21e9": "v",
            "\u2191": "^",
            "\u2003": " ",    # em space
            "\u2002": " ",    # en space
            "\u00a0": " ",    # non-breaking space
            "\u2011": "-",    # non-breaking hyphen
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        # Final fallback: strip any remaining non-latin-1 chars
        text = text.encode("latin-1", errors="replace").decode("latin-1")
        return text

    def _write_rich_line(self, text, width=None):
        """Write a line with basic bold handling."""
        w = width or (185 - self.get_x() + 25)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(w, 6, self._sanitize(text))

    def _render_code_block(self, lines):
        """Render a code block with background."""
        self.ln(2)
        self.set_fill_color(245, 245, 245)
        self.set_font("Courier", "", 7.5)
        x = self.get_x()

        for line in lines:
            # Truncate very long lines
            if len(line) > 120:
                line = line[:117] + "..."
            if self.get_y() > 250:
                self.add_page()
            self.set_x(x)
            self.cell(165, 4.5, self._sanitize(line), fill=True, new_x="LMARGIN", new_y="NEXT")

        self.set_font("Helvetica", "", 10)
        self.ln(3)

    def _render_table(self, rows):
        """Render a simple table."""
        if not rows:
            return

        self.ln(2)
        num_cols = max(len(r) for r in rows)
        col_w = min(165 / max(num_cols, 1), 55)

        # Header row
        if rows:
            self.set_font("Helvetica", "B", 8)
            self.set_fill_color(235, 235, 235)
            for j, cell in enumerate(rows[0]):
                if j < num_cols:
                    self.cell(col_w, 6, self._sanitize(cell[:40]), border=1, fill=True)
            self.ln()

        # Data rows
        self.set_font("Helvetica", "", 8)
        for row in rows[1:]:
            if self.get_y() > 250:
                self.add_page()
            for j, cell in enumerate(row):
                if j < num_cols:
                    self.cell(col_w, 5.5, self._sanitize(cell[:40]), border=1)
            self.ln()

        self.ln(3)


def main():
    pdf = PatentPDF()
    pdf.set_title("System and Method for Enterprise Application Portability")
    pdf.set_author("OverYonder, Inc.")

    # Step 1: Intro page
    pdf.add_intro_page()

    # Step 2: Each patent disclosure
    for fname in PATENT_FILES:
        fpath = PATENTS_DIR / fname
        if not fpath.exists():
            print(f"  WARNING: {fname} not found, skipping")
            continue

        text = fpath.read_text()
        pdf.add_page()
        pdf.render_markdown(text)
        print(f"  Added: {fname}")

    pdf.output(str(OUTPUT))
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"\nDone: {OUTPUT.name}")
    print(f"Size: {size_kb:.0f} KB ({pdf.page_no()} pages)")


if __name__ == "__main__":
    main()
