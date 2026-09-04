from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL_DIRECTORY = Path(__file__).resolve().parents[1]
SYNC_SCRIPT = SKILL_DIRECTORY / "scripts" / "sync_tech_specs.py"
INSTALL_SCRIPT = SKILL_DIRECTORY / "scripts" / "install_project_hook.py"


class SyncTechSpecsTests(unittest.TestCase):
    def run_sync(self, root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SYNC_SCRIPT), "--root", str(root), *arguments],
            check=False,
            capture_output=True,
            text=True,
        )

    def test_renders_and_checks_a_tech_spec(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "docs" / "tech-specs" / "email-notifications.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                """---
kind: tech-spec
title: "프로젝트별 이메일 알림 설정"
status: "초안"
owner: "플랫폼 팀"
reviewers: ["백엔드", "프론트엔드"]
last_updated: "2026-09-05"
related_issue: "https://example.com/issues/32"
html: "./email-notifications.html"
---

# 프로젝트별 이메일 알림 설정

## 요약

사용자가 프로젝트마다 이메일 알림을 켜거나 끌 수 있게 해요.

## 배경

현재는 `<script>alert(1)</script>` 같은 입력도 문서 내용으로 다룰 수 있어요.

## 목표

- 프로젝트 단위로 설정을 저장해요.
- [관련 문서](https://example.com/docs)를 연결해요.

## 목표가 아닌 것

- 모바일 푸시는 다루지 않아요.

## 계획

| 단계 | 동작 |
| --- | --- |
| 저장 | 설정을 저장해요. |

```json
{"enabled": true}
```

위험한 [링크](javascript:alert(1))는 연결하지 않아요.

## 고려 사항

권한 검사를 확인해요.

## 마일스톤

| 단계 | 완료 조건 |
| --- | --- |
| 구현 | 저장과 조회를 검증해요. |
""",
                encoding="utf-8",
            )

            rendered = self.run_sync(root, "docs/tech-specs/email-notifications.md")
            self.assertEqual(rendered.returncode, 0, rendered.stdout + rendered.stderr)
            destination = source.with_suffix(".html")
            output = destination.read_text(encoding="utf-8")
            self.assertIn("프로젝트별 이메일 알림 설정", output)
            self.assertIn("<th>단계</th>", output)
            self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", output)
            self.assertNotIn("javascript:alert", output)
            self.assertRegex(
                output, r'<meta name="tech-spec-sha256" content="[0-9a-f]{64}">'
            )

            checked = self.run_sync(
                root, "--check", "docs/tech-specs/email-notifications.md"
            )
            self.assertEqual(checked.returncode, 0, checked.stdout + checked.stderr)

            source.write_text(
                source.read_text(encoding="utf-8") + "\n새 내용을 추가해요.\n",
                encoding="utf-8",
            )
            stale = self.run_sync(
                root, "--check", "docs/tech-specs/email-notifications.md"
            )
            self.assertEqual(stale.returncode, 1)
            self.assertIn(
                "STALE docs/tech-specs/email-notifications.html", stale.stdout
            )

    def test_hook_mode_returns_json_and_skips_unmarked_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "docs" / "tech-specs" / "README.md"
            source.parent.mkdir(parents=True)
            source.write_text("# 안내\n", encoding="utf-8")

            result = self.run_sync(root, "--hook")
            self.assertEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout), {})
            self.assertFalse(source.with_suffix(".html").exists())


class InstallProjectHookTests(unittest.TestCase):
    def run_installer(self, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(INSTALL_SCRIPT), "--root", str(root)],
            check=False,
            capture_output=True,
            text=True,
        )

    def test_preserves_existing_hooks_and_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(
                ["git", "init", "-q", str(root)],
                check=True,
                capture_output=True,
                text=True,
            )
            config_path = root / ".codex" / "hooks.json"
            config_path.parent.mkdir(parents=True)
            config_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "SessionStart": [
                                {
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": "python3 existing.py",
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            first = self.run_installer(root)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            first_config_text = config_path.read_text(encoding="utf-8")
            config = json.loads(first_config_text)
            self.assertIn("SessionStart", config["hooks"])
            self.assertEqual(len(config["hooks"]["PostToolUse"]), 1)
            self.assertEqual(len(config["hooks"]["Stop"]), 1)
            self.assertTrue(
                (root / ".codex" / "hooks" / "sync_tech_specs.py").is_file()
            )

            second = self.run_installer(root)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertEqual(config_path.read_text(encoding="utf-8"), first_config_text)

            nested_directory = root / "packages" / "app"
            nested_directory.mkdir(parents=True)
            hook_command = config["hooks"]["Stop"][0]["hooks"][0]["command"]
            hook_result = subprocess.run(
                hook_command,
                cwd=nested_directory,
                shell=True,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(
                hook_result.returncode, 0, hook_result.stdout + hook_result.stderr
            )
            self.assertEqual(json.loads(hook_result.stdout), {})

    def test_does_not_overwrite_invalid_hook_config(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config_path = root / ".codex" / "hooks.json"
            config_path.parent.mkdir(parents=True)
            config_path.write_text("not-json\n", encoding="utf-8")

            result = self.run_installer(root)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(config_path.read_text(encoding="utf-8"), "not-json\n")
            self.assertFalse(
                (root / ".codex" / "hooks" / "sync_tech_specs.py").exists()
            )


if __name__ == "__main__":
    unittest.main()
