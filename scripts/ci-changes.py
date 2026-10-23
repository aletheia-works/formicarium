#!/usr/bin/env python3
"""Which CI job groups a pull request's changed files need; unknown paths need every group."""

import argparse
import os
import sys

GROUPS = ("quality", "product", "candidate")
ALL = frozenset(GROUPS)
NONE = frozenset()
# The pull-request files API lists at most 3000 files; a longer list may be cut.
API_LIMIT = 3000

# First match wins. "dir/" matches everything below dir, "*.ext" any file
# with that extension, anything else the exact path.
RULES = (
    # What every job builds or runs with, and the release candidate's own code.
    (
        ALL,
        (
            ".github/workflows/ci.yml",
            "scripts/ci-changes.py",
            "package.json",
            "bun.lock",
            "mise.toml",
            "tsconfig.json",
            "tsconfig.tests.json",
            "scripts/ci/",
            "scripts/package/",
            "tests/package/",
            "tests/tooling/release-candidate.test.ts",
            ".github/workflows/release-candidate.yml",
        ),
    ),
    # The showcase workflows decide for themselves which of their jobs run.
    (
        NONE,
        (".github/workflows/showcase.yml", ".github/workflows/showcase-site.yml"),
    ),
    # The quality tests read the release and verification workflows and the
    # release-please files.
    (
        {"quality"},
        (
            ".github/workflows/",
            ".github/release-please-config.json",
            ".github/release-please-manifest.json",
        ),
    ),
    # The package and the product regressions that run it.
    (
        {"quality", "product"},
        (
            "runtime/",
            "web/",
            "types/",
            "tests/node/",
            "tests/browser/",
            "tests/shared/",
            "playwright.config.ts",
            "scripts/session-info.ts",
            "scripts/serve.ts",
            # tests/tooling/bun-tasks.test.ts checks the task paths ci.yml names.
            "mise-tasks/build/",
        ),
    ),
    # Guest builds, their inputs and the native baselines.
    (
        {"product"},
        (
            "guest/",
            "fixtures/",
            "scripts/lib/",
        ),
    ),
    # Files the package ships, lint settings, and the other scripts and tests.
    (
        {"quality"},
        (
            "README.md",
            "LICENSE",
            "THIRD_PARTY_NOTICES.md",
            "biome.json",
            ".gitignore",
            "scripts/",
            "tests/",
        ),
    ),
    # Infrastructure, the showcase (its workflows filter their
    # own paths), bot settings and local development tasks. Polyglot lint runs
    # Biome over all of them on every pull request.
    (
        NONE,
        (
            "infra/",
            "showcase/",
            ".github/",
            "mise-tasks/",
            "*.md",
        ),
    ),
)


def matches(path, pattern):
    if pattern.endswith("/"):
        return path.startswith(pattern)
    if pattern.startswith("*."):
        return path.endswith(pattern[1:])
    return path == pattern


def groups_for(path):
    for groups, patterns in RULES:
        if any(matches(path, p) for p in patterns):
            return frozenset(groups)
    return ALL


def needed(paths):
    paths = [p for p in paths if p]
    if not paths or len(paths) >= API_LIMIT:
        return ALL
    return frozenset().union(*(groups_for(p) for p in paths))


def self_test():
    cases = {
        "AGENTS.md": NONE,
        "CONTRIBUTING.md": NONE,
        "README.md": {"quality"},
        "THIRD_PARTY_NOTICES.md": {"quality"},
        "infra/github/main.tf": NONE,
        ".github/workflows/showcase.yml": NONE,
        ".github/workflows/showcase-site.yml": NONE,
        ".github/labeler.yml": NONE,
        ".github/workflows/publish.yml": {"quality"},
        ".github/workflows/verify.yml": {"quality"},
        ".github/workflows/claude-review.yml": {"quality"},
        ".github/release-please-config.json": {"quality"},
        ".github/release-please-manifest.json": {"quality"},
        "showcase/scripts/pack.ts": NONE,
        "mise-tasks/showcase/unit.sh": NONE,
        ".github/workflows/ci.yml": ALL,
        "scripts/ci-changes.py": ALL,
        "package.json": ALL,
        "bun.lock": ALL,
        "scripts/ci/run.ts": ALL,
        "scripts/package/coverage.ts": ALL,
        "tests/package/core.test.ts": ALL,
        "tests/tooling/release-candidate.test.ts": ALL,
        ".github/workflows/release-candidate.yml": ALL,
        "runtime/core.ts": {"quality", "product"},
        "types/index.d.ts": {"quality", "product"},
        "tests/browser/probe.spec.ts": {"quality", "product"},
        "guest/probe/src/main.rs": {"product"},
        "fixtures/baseline/aube-1645.native.txt": {"product"},
        "mise-tasks/build/guests.sh": {"quality", "product"},
        "scripts/release/publication.ts": {"quality"},
        "tests/release/evidence.test.ts": {"quality"},
        "biome.json": {"quality"},
        "unknown-top-level-file": ALL,
    }
    for path, expected in cases.items():
        got = groups_for(path)
        if got != frozenset(expected):
            raise AssertionError(f"{path}: {sorted(got)} != {sorted(expected)}")
    if needed([]) != ALL or needed(["docs/a.md"] * API_LIMIT) != ALL:
        raise AssertionError("an empty or possibly cut file list must need every group")
    if needed(["docs/a.md", "infra/github/main.tf"]) != NONE:
        raise AssertionError("documentation and infrastructure need no group")
    if needed(["README.md", "guest/probe/src/main.rs"]) != {"quality", "product"}:
        raise AssertionError("groups of several files must be joined")
    print(f"ci-changes ready: {len(cases)} paths checked")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--all", action="store_true", help="need every group")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    groups = ALL if args.all else needed(sys.stdin.read().splitlines())
    lines = [f"{g}={'true' if g in groups else 'false'}" for g in GROUPS]
    print("\n".join(lines))
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
