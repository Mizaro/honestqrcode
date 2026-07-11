"""Dependency-free structural checks for the static site."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import json
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://honestqrcode.com"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = None
        self.h1_count = 0
        self.in_title = False
        self.title_parts = []
        self.local_refs = []
        self.json_ld = []
        self.in_json_ld = False
        self.json_parts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href")
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.in_title = True
        if tag == "script" and values.get("type") == "application/ld+json":
            self.in_json_ld = True
            self.json_parts = []
        for attribute in ("href", "src"):
            value = values.get(attribute)
            if value and value.startswith("/") and not value.startswith("//"):
                self.local_refs.append(value)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_json_ld:
            self.in_json_ld = False
            self.json_ld.append("".join(self.json_parts))

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_json_ld:
            self.json_parts.append(data)


def local_target(reference: str) -> Path:
    path = urlparse(reference).path.lstrip("/")
    target = ROOT / path
    if reference.endswith("/") or not target.suffix:
        target = target / "index.html"
    return target


def main():
    errors = []
    pages = {}
    canonicals = set()
    titles = set()

    for path in sorted(ROOT.rglob("*.html")):
        parser = PageParser()
        parser.feed(path.read_text(encoding="utf-8"))
        relative = path.relative_to(ROOT).as_posix()
        title = "".join(parser.title_parts).strip()
        pages[relative] = parser

        if relative != "404.html":
            if not parser.canonical or not parser.canonical.startswith(f"{SITE}/"):
                errors.append(f"{relative}: missing or invalid canonical")
            elif parser.canonical in canonicals:
                errors.append(f"{relative}: duplicate canonical {parser.canonical}")
            else:
                canonicals.add(parser.canonical)
        if parser.h1_count != 1:
            errors.append(f"{relative}: expected one h1, found {parser.h1_count}")
        if not title:
            errors.append(f"{relative}: missing title")
        elif title in titles:
            errors.append(f"{relative}: duplicate title {title}")
        else:
            titles.add(title)

        for source in parser.json_ld:
            try:
                json.loads(source)
            except json.JSONDecodeError as error:
                errors.append(f"{relative}: invalid JSON-LD ({error})")
        for reference in parser.local_refs:
            target = local_target(reference)
            if not target.exists():
                errors.append(f"{relative}: missing local target {reference}")

    manifest = json.loads((ROOT / "site.webmanifest").read_text(encoding="utf-8"))
    if manifest.get("start_url") != "/":
        errors.append("site.webmanifest: start_url must be /")

    sitemap = ET.parse(ROOT / "sitemap.xml")
    sitemap_urls = {element.text for element in sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")}
    if sitemap_urls != canonicals:
        errors.append(f"sitemap canonical mismatch: sitemap={sorted(sitemap_urls)} pages={sorted(canonicals)}")

    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if f"Sitemap: {SITE}/sitemap.xml" not in robots:
        errors.append("robots.txt: missing canonical sitemap URL")

    app_source = (ROOT / "app.js").read_text(encoding="utf-8")
    for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon"):
        if forbidden in app_source:
            errors.append(f"app.js: unexpected outbound API {forbidden}")

    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".html", ".js", ".css", ".xml", ".txt", ".md", ".json"}:
            if "getqrcode.com" in path.read_text(encoding="utf-8", errors="ignore"):
                errors.append(f"{path.relative_to(ROOT)}: stale domain reference")

    if errors:
        raise SystemExit("\n".join(f"ERROR: {error}" for error in errors))
    print(f"Validated {len(pages)} HTML pages, {len(canonicals)} canonical URLs, and all local references.")


if __name__ == "__main__":
    main()
