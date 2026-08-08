#!/usr/bin/env python3
"""Validate common Fastlane App Store metadata for a localized release."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


RELEASE_NOTE_PATHS = (
    Path("ko/release_notes.txt"),
    Path("ja/release_notes.txt"),
    Path("en-US/release_notes.txt"),
)
REVIEW_NOTES_PATH = Path("review_information/notes.txt")
REQUIRED_REVIEW_HEADINGS = (
    "[로그인 안내]",
    "[업데이트 내용 안내]",
    "[Login Instructions]",
    "[Update Information]",
)


def read_text(path: Path, errors: list[str]) -> str:
    if not path.is_file():
        errors.append(f"missing file: {path}")
        return ""

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"not valid UTF-8: {path}")
        return ""

    if not text.strip():
        errors.append(f"empty file: {path}")
    elif not text.endswith("\n"):
        errors.append(f"missing trailing newline: {path}")
    elif "TODO" in text.upper():
        errors.append(f"contains TODO placeholder: {path}")
    return text


def release_bullets(path: Path, text: str, errors: list[str]) -> list[str]:
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    if not lines[0].startswith("■"):
        errors.append(f"release note must start with a ■ heading: {path}")

    bullets = [line[2:].strip() for line in lines[1:] if line.startswith("- ")]
    if not bullets:
        errors.append(f"release note must contain at least one '- ' bullet: {path}")
    if len(bullets) > 4:
        errors.append(f"release note has more than four bullets: {path}")
    return bullets


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--metadata-root",
        type=Path,
        default=Path("fastlane/metadata"),
        help="Fastlane metadata directory (default: fastlane/metadata)",
    )
    args = parser.parse_args()

    root = args.metadata_root
    errors: list[str] = []
    korean_bullets: list[str] = []

    for relative_path in RELEASE_NOTE_PATHS:
        path = root / relative_path
        text = read_text(path, errors)
        bullets = release_bullets(path, text, errors)
        if relative_path.parts[0] == "ko":
            korean_bullets = bullets

    review_path = root / REVIEW_NOTES_PATH
    review_text = read_text(review_path, errors)
    for heading in REQUIRED_REVIEW_HEADINGS:
        if heading not in review_text:
            errors.append(f"review notes missing required heading: {heading}")
    for bullet in korean_bullets:
        if f"- {bullet}" not in review_text:
            errors.append(f"review notes do not include Korean release-note bullet: {bullet}")

    if errors:
        print("Metadata validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Metadata validation passed for ko, ja, en-US, and App Review notes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
