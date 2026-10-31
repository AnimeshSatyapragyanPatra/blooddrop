"""Facts pulled from the codebase, so the reports cannot drift from the code."""
import json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read(p):
    f = ROOT / p
    return f.read_text() if f.exists() else ""


def gather():
    migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
    sql = "\n".join(m.read_text() for m in migrations)

    tables = sorted(set(re.findall(r"create table if not exists public\.(\w+)", sql)))
    policies = len(re.findall(r"create policy", sql))
    indexes = len(re.findall(r"create index", sql))

    routes = []
    for f in sorted((ROOT / "backend/src/routes").glob("*.js")):
        for verb, path in re.findall(r'\.(get|post|put|patch|delete)\("([^"]*)"', f.read_text()):
            routes.append(f"{verb.upper()} {path}")

    pages = sorted(p.stem for p in (ROOT / "frontend/src/pages").glob("*.jsx"))
    components = sorted(p.stem for p in (ROOT / "frontend/src/components").glob("*.jsx"))
    libs = sorted(p.stem for p in (ROOT / "backend/src/lib").glob("*.js"))
    controllers = sorted(p.stem for p in (ROOT / "backend/src/controllers").glob("*.js"))

    smoke = _read("backend/scripts/smoke.js")
    assertions = len(re.findall(r"\bcheck\(", smoke))

    fe = json.loads(_read("frontend/package.json"))
    be = json.loads(_read("backend/package.json"))

    try:
        commits = subprocess.run(
            ["git", "log", "--oneline"], cwd=ROOT, capture_output=True, text=True
        ).stdout.strip().splitlines()
    except Exception:
        commits = []

    return dict(
        tables=tables, policies=policies, indexes=indexes,
        routes=routes, pages=pages, components=components,
        libs=libs, controllers=controllers,
        assertions=assertions,
        frontend_deps=fe.get("dependencies", {}), frontend_dev=fe.get("devDependencies", {}),
        backend_deps=be.get("dependencies", {}),
        commits=commits, migrations=[m.name for m in migrations],
    )


if __name__ == "__main__":
    f = gather()
    print(f"tables={len(f['tables'])} routes={len(f['routes'])} pages={len(f['pages'])} "
          f"assertions={f['assertions']} policies={f['policies']} commits={len(f['commits'])}")
