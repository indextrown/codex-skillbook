#!/usr/bin/env python3
"""한국어 윤문 전후의 보호 요소와 과윤문 위험을 결정적으로 점검한다.

epoko77-ai/im-not-ai v2.2.0의 변경률 게이트와 golden regression checks에서
검증 철학을 가져와, 전역 Codex 파일 편집 흐름에 맞게 다시 구현했다.
원 프로젝트는 MIT License이며 스킬 루트의 LICENSE.im-not-ai에 전문을 보존한다.

Exit codes:
    0: 통과
    1: 검토가 필요한 경고
    2: 보호 요소 소실 또는 변경률 중단선 초과
    3: 실행 오류
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class Finding:
    level: str
    code: str
    message: str


FENCE_RE = re.compile(r"(?ms)^(```|~~~)[^\n]*\n.*?^\1[ \t]*$")
INLINE_CODE_RE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")
URL_RE = re.compile(r"(?:https?://|mailto:)[^\s<>\"')\]]+")
HTML_PATH_RE = re.compile(r"\b(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)
NUMBER_RE = re.compile(
    r"(?<![\w])(?:\d{4}-\d{1,2}-\d{1,2}|\d+(?:[.,:/-]\d+)*)"
    r"(?:%|배|명|시간|분|초|회|개|건|자|년|월|일)?"
)
SUMMARY_RE = re.compile(r"<!--\s*HUMANIZE-SUMMARY\b.*", re.DOTALL)
INLINE_FOOTNOTE_RE = re.compile(r"(?<=\S)(?<![(\d])(\d{1,3})\)")
FOOTNOTE_DEF_RE = re.compile(r"^\s*(\d{1,3})\)\s+(.+)$", re.MULTILINE)

CLICHE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("기록적인 성과", re.compile(r"기록적인\s*성과")),
    ("괄목할 만한", re.compile(r"괄목할\s*만한")),
    ("~로 평가된다", re.compile(r"로\s*평가(?:된다|받|되)")),
    ("주목받-", re.compile(r"주목받")),
    ("크게 기여", re.compile(r"크게\s*기여")),
    ("중요한 역할을 한다", re.compile(r"중요한\s*역할을\s*(?:한다|했다|할)")),
    ("시사하는 바가 크다", re.compile(r"시사하는\s*바가\s*크")),
    ("의미가 크다", re.compile(r"의미가\s*크다")),
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_summary(text: str) -> str:
    return SUMMARY_RE.sub("", text).rstrip()


def strip_markup(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        line = re.sub(r"^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)", "", line)
        line = re.sub(r"[*_~]", "", line)
        lines.append(line)
    return "\n".join(lines)


def change_rate(before: str, after: str, ignore_markup: bool) -> float:
    if ignore_markup:
        before = strip_markup(before)
        after = strip_markup(after)
    return 1.0 - difflib.SequenceMatcher(None, before, after).ratio()


def frontmatter(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end < 0:
        return None
    return text[: end + 5]


def fenced_blocks(text: str) -> list[str]:
    return [m.group(0) for m in FENCE_RE.finditer(text)]


def without_fences(text: str) -> str:
    return FENCE_RE.sub("", text)


def inline_code(text: str) -> list[str]:
    return INLINE_CODE_RE.findall(without_fences(text))


def urls(text: str) -> list[str]:
    found: list[str] = []
    for raw in URL_RE.findall(text):
        found.append(raw.rstrip(".,;:!?)]}"))
    return found


def html_paths(text: str) -> list[str]:
    return HTML_PATH_RE.findall(text)


def number_tokens(text: str) -> list[str]:
    return NUMBER_RE.findall(text)


def direct_quotes(text: str) -> list[str]:
    clean = without_fences(text)
    found: list[str] = []
    for opening, closing in (("「", "」"), ("『", "』"), ("“", "”")):
        pattern = re.escape(opening) + r"([^" + re.escape(closing) + r"]+)" + re.escape(closing)
        found.extend(q for q in re.findall(pattern, clean) if len(q.strip()) >= 4)
    for line in clean.splitlines():
        if line.lstrip().startswith(("---", "title:", "src=", "href=")):
            continue
        found.extend(q for q in re.findall(r'(?<![=])"([^"\n]{8,})"', line) if q.strip())
    return found


def heading_signature(text: str) -> list[str]:
    signature: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if match := re.match(r"^(#{1,6})\s+", line):
            signature.append(f"markdown-{len(match.group(1))}")
        elif re.match(r"^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+\.\s*", line):
            signature.append("roman")
        elif re.match(r"^\d{1,2}\.\s+", line):
            signature.append("decimal")
        elif re.match(r"^\(\d{1,2}\)\s*", line):
            signature.append("parenthesized")
        elif re.match(r"^제\d+[장절]\s*", line):
            signature.append("chapter")
    return signature


def footnote_markers(text: str) -> Counter[str]:
    body = "\n".join(
        line for line in text.splitlines() if not FOOTNOTE_DEF_RE.match(line)
    )
    return Counter(INLINE_FOOTNOTE_RE.findall(body))


def footnote_defs(text: str) -> dict[str, str]:
    return {
        number: re.sub(r"\s+", " ", definition).strip()
        for number, definition in FOOTNOTE_DEF_RE.findall(text)
    }


def dominant_register(text: str) -> tuple[str, dict[str, int]]:
    counts = {"합쇼체": 0, "해요체": 0, "한다체": 0}
    for raw in re.split(r"[.!?…\n]+", without_fences(text)):
        sentence = re.sub(r"[\"'”’》」』)\]]+$", "", raw.strip())
        if not sentence:
            continue
        if re.search(r"(?:니다|니까)$", sentence):
            counts["합쇼체"] += 1
        elif re.search(r"요$", sentence):
            counts["해요체"] += 1
        elif re.search(r"다$", sentence):
            counts["한다체"] += 1
    register = max(counts, key=counts.get)
    return (register if counts[register] >= 2 else "불명", counts)


def missing_items(before: list[str], after: list[str]) -> list[str]:
    remaining = Counter(after)
    missing: list[str] = []
    for item in before:
        if remaining[item] > 0:
            remaining[item] -= 1
        else:
            missing.append(item)
    return missing


def preview(items: list[str], limit: int = 3) -> str:
    values = []
    for item in items[:limit]:
        compact = re.sub(r"\s+", " ", item).strip()
        values.append(compact if len(compact) <= 70 else compact[:67] + "…")
    suffix = f" 외 {len(items) - limit}건" if len(items) > limit else ""
    return ", ".join(repr(v) for v in values) + suffix


def add_missing_check(
    findings: list[Finding],
    code: str,
    label: str,
    before: list[str],
    after: list[str],
) -> None:
    missing = missing_items(before, after)
    if missing:
        findings.append(
            Finding("error", code, f"{label} {len(missing)}건이 사라지거나 바뀌었습니다: {preview(missing)}")
        )


def add_presence_check(
    findings: list[Finding],
    code: str,
    label: str,
    before: list[str],
    after: list[str],
) -> None:
    """같은 값의 중복 정리는 허용하고, 값 자체가 사라졌을 때만 막는다."""
    missing = sorted(set(before) - set(after))
    if missing:
        findings.append(
            Finding("error", code, f"{label} {len(missing)}종이 사라지거나 바뀌었습니다: {preview(missing)}")
        )


def run_checks(args: argparse.Namespace, before: str, after: str) -> tuple[list[Finding], float]:
    findings: list[Finding] = []
    before = strip_summary(before)
    after = strip_summary(after)

    rate = change_rate(before, after, args.ignore_markup)
    if rate >= args.abort_rate:
        findings.append(
            Finding("error", "change_rate_abort", f"변경률이 {rate * 100:.1f}%로 중단선 {args.abort_rate * 100:.0f}% 이상입니다.")
        )
    elif rate >= args.warn_rate:
        findings.append(
            Finding("warning", "change_rate_warn", f"변경률이 {rate * 100:.1f}%로 경고선 {args.warn_rate * 100:.0f}% 이상입니다.")
        )

    if not args.allow_frontmatter_changes and frontmatter(before) != frontmatter(after):
        findings.append(Finding("error", "frontmatter_changed", "front matter가 사라지거나 바뀌었습니다."))

    if not args.allow_heading_changes and heading_signature(before) != heading_signature(after):
        findings.append(Finding("error", "heading_structure_changed", "제목의 개수나 단계가 바뀌었습니다."))

    add_missing_check(findings, "code_block_changed", "코드 블록", fenced_blocks(before), fenced_blocks(after))
    add_missing_check(findings, "inline_code_changed", "인라인 코드", inline_code(before), inline_code(after))
    add_missing_check(findings, "url_changed", "URL", urls(before), urls(after))
    add_missing_check(findings, "html_path_changed", "HTML src/href 경로", html_paths(before), html_paths(after))
    add_presence_check(findings, "number_changed", "수치·날짜·단위", number_tokens(before), number_tokens(after))
    add_missing_check(findings, "quote_changed", "직접 인용", direct_quotes(before), direct_quotes(after))
    add_missing_check(findings, "manual_protection_changed", "사용자 보호 문자열", args.protect, [p for p in args.protect if p in after])

    before_markers = footnote_markers(before)
    after_markers = footnote_markers(after)
    if before_markers != after_markers:
        findings.append(Finding("error", "footnote_markers_changed", "본문 각주 번호나 개수가 바뀌었습니다."))

    before_defs = footnote_defs(before)
    after_defs = footnote_defs(after)
    for number, definition in before_defs.items():
        if after_defs.get(number) != definition:
            findings.append(Finding("error", "footnote_definition_changed", f"각주 {number})의 정의가 사라지거나 바뀌었습니다."))

    before_register, before_counts = dominant_register(before)
    after_register, after_counts = dominant_register(after)
    if before_register != "불명" and after_register != "불명" and before_register != after_register:
        findings.append(
            Finding(
                "error",
                "register_changed",
                f"주된 말투가 {before_register}에서 {after_register}로 바뀌었습니다 "
                f"({before_counts} → {after_counts}).",
            )
        )

    if after.count("하였") > before.count("하였"):
        findings.append(Finding("warning", "hayeot_injection", "원문에 없던 '하였' 계열이 늘어 격식이 높아졌을 수 있습니다."))

    for name, pattern in CLICHE_PATTERNS:
        old_count = len(pattern.findall(before))
        new_count = len(pattern.findall(after))
        if new_count > old_count:
            findings.append(
                Finding("warning", "cliche_injection", f"상투구 '{name}'이 {old_count}회에서 {new_count}회로 늘었습니다.")
            )

    return findings, rate


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="한국어 윤문 보호 요소·변경률 검증")
    parser.add_argument("--before", required=True, type=Path, help="윤문 전 파일")
    parser.add_argument("--after", required=True, type=Path, help="윤문 후 파일")
    parser.add_argument("--warn-rate", type=float, default=0.30, help="변경률 경고선 (기본 0.30)")
    parser.add_argument("--abort-rate", type=float, default=0.50, help="변경률 중단선 (기본 0.50)")
    parser.add_argument("--ignore-markup", action="store_true", help="변경률 계산에서 마크다운 장식을 단순화")
    parser.add_argument("--allow-heading-changes", action="store_true", help="제목 개수·단계 변경 허용")
    parser.add_argument("--allow-frontmatter-changes", action="store_true", help="front matter 변경 허용")
    parser.add_argument("--protect", action="append", default=[], help="반드시 그대로 남아야 할 문자열. 여러 번 지정 가능")
    parser.add_argument("--json", action="store_true", help="결과를 JSON으로 출력")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not 0 <= args.warn_rate < args.abort_rate <= 1:
        print("error: 0 <= warn-rate < abort-rate <= 1 이어야 합니다.", file=sys.stderr)
        return 3
    for path in (args.before, args.after):
        if not path.is_file():
            print(f"error: 파일을 찾을 수 없습니다: {path}", file=sys.stderr)
            return 3

    try:
        before = read_text(args.before)
        after = read_text(args.after)
    except (OSError, UnicodeError) as exc:
        print(f"error: 파일을 읽지 못했습니다: {exc}", file=sys.stderr)
        return 3

    findings, rate = run_checks(args, before, after)
    if any(item.level == "error" for item in findings):
        verdict, exit_code = "BLOCK", 2
    elif findings:
        verdict, exit_code = "REVIEW", 1
    else:
        verdict, exit_code = "PASS", 0

    if args.json:
        print(
            json.dumps(
                {
                    "verdict": verdict,
                    "change_rate": round(rate, 6),
                    "findings": [asdict(item) for item in findings],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(f"{verdict} · 변경률 {rate * 100:.1f}%")
        if findings:
            for item in findings:
                print(f"- {item.level.upper()} [{item.code}] {item.message}")
        else:
            print("- 보호 요소, 문서 구조, 주된 말투에서 알려진 위반을 찾지 못했습니다.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
