#!/usr/bin/env python3
"""Create the public Upshot GitHub Project from ROADMAP.md.

ROADMAP.md is the source of truth: every "| Item | Kind |" table row under an
"## M<n> — ..." heading becomes a draft item, and every bullet under "## Later"
becomes a draft item in the Later milestone.

Dry run by default (prints what it would create). Pass --apply to create it.
Needs `gh` logged in as DavinKaru with the `project` scope:

    gh auth login                 # pick DavinKaru
    gh auth refresh -s project

Safe to re-run: if a project with the same title exists it is reused, and only
missing fields and items (matched by title) are added.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

OWNER = "DavinKaru"
TITLE = "Upshot"
DESCRIPTION = "Roadmap for Upshot, an unofficial open-source insights app for Up customers."
ROADMAP = Path(__file__).resolve().parent.parent / "ROADMAP.md"

MILESTONES = {
    "M1": "M1 Shell",
    "M2": "M2 Connect",
    "M3": "M3 Real data",
    "M4": "M4 Insights",
    "M5": "M5 Release",
    "Later": "Later",
}
TYPES = ["Feature", "Design", "Chore", "Decision", "Docs", "Security"]
SIZES = ["XS", "S", "M", "L"]


def plain(text):
    """Strip the markdown we use in ROADMAP.md so titles read cleanly."""
    return text.replace("**", "").replace("`", "").strip()


def make_title(text):
    bold = re.match(r"\*\*(.+?)\*\*", text)
    if bold:
        return plain(bold.group(1)).rstrip(".")
    title = plain(text)
    # Cut at the first natural break (a colon, bracket or semicolon), keeping the full text for the body.
    breaks = [i for i in (title.find(": "), title.find(" ("), title.find("; ")) if 0 < i <= 70]
    if breaks:
        return title[:min(breaks)]
    if len(title) <= 80:
        return title
    return title[:80].rsplit(" ", 1)[0] + "…"


def parse_roadmap(path):
    items = []
    milestone = None
    for line in path.read_text().splitlines():
        heading = re.match(r"^## (M\d|Later)\b", line)
        if heading:
            milestone = MILESTONES[heading.group(1)]
            continue
        if line.startswith("## "):
            milestone = None
            continue
        if milestone is None:
            continue

        row = re.match(r"^\|(.+)\|(.+)\|\s*$", line)
        if row and milestone != "Later":
            text, kind = row.group(1).strip(), row.group(2).strip()
            if kind in TYPES:
                items.append({"title": make_title(text), "body": plain(text),
                              "milestone": milestone, "type": kind})
            elif kind != "Kind" and not set(kind) <= set("-: "):
                sys.exit(f"Unknown Kind {kind!r} in ROADMAP.md row: {line}")
            continue

        bullet = re.match(r"^- (.+)$", line)
        if bullet and milestone == "Later":
            text = bullet.group(1).strip()
            items.append({"title": make_title(text), "body": plain(text),
                          "milestone": milestone, "type": "Feature"})
    return items


def gh(*args):
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"gh {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout


def gh_json(*args):
    return json.loads(gh(*args, "--format", "json"))


def apply(items):
    login = gh("api", "user", "--jq", ".login").strip()
    if login != OWNER:
        sys.exit(f"gh is logged in as {login}, not {OWNER}. Run `gh auth switch -u {OWNER}`.")

    projects = gh_json("project", "list", "--owner", OWNER, "--limit", "100")["projects"]
    matches = [p for p in projects if p["title"] == TITLE]
    if len(matches) > 1:
        sys.exit(f"{len(matches)} projects are called {TITLE!r}; delete the extras first.")
    if matches:
        project = matches[0]
        print(f"Reusing existing project #{project['number']}; only missing fields and items are added.")
    else:
        project = gh_json("project", "create", "--owner", OWNER, "--title", TITLE)
    number, project_id = str(project["number"]), project["id"]
    gh("project", "edit", number, "--owner", OWNER,
       "--visibility", "PUBLIC", "--description", DESCRIPTION)

    def load_fields():
        return {f["name"]: f for f in gh_json("project", "field-list", number, "--owner", OWNER)["fields"]}

    fields = load_fields()
    # GitHub reserves "Milestone" (repository milestones) and "Type" (issue types), hence "Phase" and "Kind".
    for name, options in [("Phase", list(MILESTONES.values())), ("Kind", TYPES), ("Size", SIZES)]:
        if name not in fields:
            gh("project", "field-create", number, "--owner", OWNER, "--name", name,
               "--data-type", "SINGLE_SELECT", "--single-select-options", ",".join(options))
            continue
        if fields[name].get("type") != "ProjectV2SingleSelectField":
            sys.exit(f"Field {name!r} already exists but isn't a single-select field; "
                     "rename or delete it in the project settings, then re-run.")
        have = {o["name"] for o in fields[name].get("options", [])}
        missing = [o for o in options if o not in have]
        if missing:
            sys.exit(f"Field {name!r} already exists but lacks options {missing}. "
                     "Add them in the project settings, or delete the field, then re-run.")
    fields = load_fields()

    def option_id(field, value):
        return next(o["id"] for o in fields[field]["options"] if o["name"] == value)

    existing = gh_json("project", "item-list", number, "--owner", OWNER, "--limit", "1000")["items"]
    titles = {i.get("title") or i.get("content", {}).get("title") for i in existing}
    skipped = [item for item in items if item["title"] in titles]
    items = [item for item in items if item["title"] not in titles]
    if skipped:
        print(f"Skipping {len(skipped)} items that already exist.")

    for i, item in enumerate(items, 1):
        body = f"{item['body']}\n\nSource: ROADMAP.md, {item['milestone']}."
        created = gh_json("project", "item-create", number, "--owner", OWNER,
                          "--title", item["title"], "--body", body)
        for key, name in (("milestone", "Phase"), ("type", "Kind")):
            gh("project", "item-edit", "--id", created["id"], "--project-id", project_id,
               "--field-id", fields[name]["id"],
               "--single-select-option-id", option_id(name, item[key]))
        print(f"[{i}/{len(items)}] {item['milestone']:<13} {item['type']:<9} {item['title']}")

    print(f"\nCreated https://github.com/users/{OWNER}/projects/{number}")
    print("Views can't be created through the API. Add these in the UI:")
    print("  Roadmap (group by Phase), Board (group by Status), Decisions (filter Kind:Decision)")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="create the project (default: dry run)")
    args = parser.parse_args()

    items = parse_roadmap(ROADMAP)
    if not args.apply:
        for item in items:
            print(f"{item['milestone']:<13} {item['type']:<9} {item['title']}")
        print(f"\n{len(items)} items. Dry run: nothing created. Re-run with --apply.")
        return
    apply(items)


if __name__ == "__main__":
    main()
