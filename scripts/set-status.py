#!/usr/bin/env python3
"""Set the Status of Upshot project items, matched by exact title.

    scripts/set-status.py Done "Confirm the stack" "Repo docs"
    scripts/set-status.py "In progress" "CI pipeline"   # status is matched ignoring case

Every title is checked before anything changes, so a typo changes nothing.
Needs `gh` logged in as DavinKaru with the `project` scope.
"""

import json
import subprocess
import sys

OWNER = "DavinKaru"
TITLE = "Upshot"


def gh(*args):
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"gh {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout


def gh_json(*args):
    return json.loads(gh(*args, "--format", "json"))


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    status, titles = sys.argv[1], sys.argv[2:]

    projects = gh_json("project", "list", "--owner", OWNER, "--limit", "100")["projects"]
    project = next((p for p in projects if p["title"] == TITLE), None)
    if project is None:
        sys.exit(f"No project called {TITLE!r} for {OWNER}.")
    number = str(project["number"])

    fields = gh_json("project", "field-list", number, "--owner", OWNER)["fields"]
    field = next(f for f in fields if f["name"] == "Status")
    options = {o["name"].casefold(): o for o in field["options"]}
    option = options.get(status.casefold())
    if option is None:
        names = ", ".join(o["name"] for o in field["options"])
        sys.exit(f"Unknown status {status!r}. Choose one of: {names}")
    status = option["name"]

    items = gh_json("project", "item-list", number, "--owner", OWNER, "--limit", "1000")["items"]
    by_title = {}
    for item in items:
        by_title.setdefault(item.get("title") or item.get("content", {}).get("title"), []).append(item)

    missing = [t for t in titles if t not in by_title]
    duplicated = [t for t in titles if len(by_title.get(t, [])) > 1]
    if missing or duplicated:
        for t in missing:
            print(f"No item titled {t!r}", file=sys.stderr)
        for t in duplicated:
            print(f"More than one item titled {t!r}", file=sys.stderr)
        sys.exit("Nothing changed.")

    for t in titles:
        gh("project", "item-edit", "--id", by_title[t][0]["id"], "--project-id", project["id"],
           "--field-id", field["id"], "--single-select-option-id", option["id"])
        print(f"{status:<12} {t}")


if __name__ == "__main__":
    main()
