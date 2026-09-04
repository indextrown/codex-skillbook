#!/usr/bin/env python3
"""Install the tech-spec synchronizer as an idempotent project-local Codex hook."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

HOOK_DIRECTORY = Path(".codex/hooks")
HOOK_CONFIG = Path(".codex/hooks.json")
HOOK_SCRIPT_NAME = "sync_tech_specs.py"
HOOK_COMMAND = (
    'python3 "$(git rev-parse --show-toplevel)/.codex/hooks/sync_tech_specs.py" '
    '--root "$(git rev-parse --show-toplevel)" --hook'
)


class InstallError(ValueError):
    """Raised when existing project hook configuration cannot be preserved."""


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", dir=path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.replace(temporary_name, path)
    except Exception:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise InstallError(
            f"기존 {path} 파일이 올바른 JSON이 아니어서 수정하지 않았어요."
        ) from error
    if not isinstance(loaded, dict):
        raise InstallError(f"기존 {path} 파일의 최상위 값은 객체여야 해요.")
    return loaded


def event_has_sync_hook(groups: list[Any]) -> bool:
    for group in groups:
        if not isinstance(group, dict):
            continue
        hooks = group.get("hooks", [])
        if not isinstance(hooks, list):
            continue
        for hook in hooks:
            if isinstance(hook, dict) and HOOK_SCRIPT_NAME in str(
                hook.get("command", "")
            ):
                return True
    return False


def add_hook(config: dict[str, Any], event: str, matcher: str | None) -> bool:
    hooks = config.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        raise InstallError("기존 hooks 값이 객체가 아니어서 안전하게 병합할 수 없어요.")
    groups = hooks.setdefault(event, [])
    if not isinstance(groups, list):
        raise InstallError(
            f"기존 hooks.{event} 값이 배열이 아니어서 안전하게 병합할 수 없어요."
        )
    if event_has_sync_hook(groups):
        return False

    group: dict[str, Any] = {
        "hooks": [
            {
                "type": "command",
                "command": HOOK_COMMAND,
                "timeout": 30,
                "statusMessage": "테크 스펙 HTML을 동기화하는 중",
            }
        ]
    }
    if matcher is not None:
        group["matcher"] = matcher
    groups.append(group)
    return True


def install(root: Path) -> tuple[bool, bool]:
    source_script = Path(__file__).with_name(HOOK_SCRIPT_NAME)
    if not source_script.is_file():
        raise InstallError(f"동기화 스크립트를 찾을 수 없어요: {source_script}")

    config_path = root / HOOK_CONFIG
    config = load_config(config_path)
    post_added = add_hook(config, "PostToolUse", "apply_patch|Edit|Write")
    stop_added = add_hook(config, "Stop", None)
    config_changed = post_added or stop_added or not config_path.exists()

    destination_script = root / HOOK_DIRECTORY / HOOK_SCRIPT_NAME
    source_bytes = source_script.read_bytes()
    script_changed = (
        not destination_script.exists()
        or destination_script.read_bytes() != source_bytes
    )
    if script_changed:
        destination_script.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{destination_script.name}.", dir=destination_script.parent
        )
        os.close(descriptor)
        try:
            shutil.copyfile(source_script, temporary_name)
            os.chmod(temporary_name, 0o755)
            os.replace(temporary_name, destination_script)
        except Exception:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass
            raise

    if config_changed:
        atomic_write(
            config_path, json.dumps(config, ensure_ascii=False, indent=2) + "\n"
        )
    return script_changed, config_changed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="프로젝트에 테크 스펙 HTML 동기화 훅을 설치해요."
    )
    parser.add_argument("--root", default=".", help="대상 저장소 루트")
    return parser


def main() -> int:
    arguments = build_parser().parse_args()
    root = Path(arguments.root).resolve()
    if not root.is_dir():
        print(f"ERROR 저장소 루트를 찾을 수 없어요: {root}")
        return 2
    try:
        script_changed, config_changed = install(root)
    except (OSError, InstallError) as error:
        print(f"ERROR {error}")
        return 2

    if script_changed or config_changed:
        print("테크 스펙 HTML 동기화 훅을 설치했어요.")
    else:
        print("테크 스펙 HTML 동기화 훅이 이미 최신 상태예요.")
    print("Codex에서 /hooks를 열어 프로젝트 훅을 검토하고 신뢰해 주세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
