# codex-skillbook

Codex에서 반복하는 작업을 같은 기준으로 처리할 수 있도록, 전역 스킬을 모아 둔 저장소입니다. 스킬 이름을 선택하면 필요한 상황과 상세 워크플로우를 확인할 수 있습니다.

## Codex 스킬이란?

스킬은 Codex가 반복되는 작업을 처리할 때 참고하는 지침과 자료 묶음입니다. 각 스킬은 `SKILL.md`를 중심으로 언제 사용해야 하는지, 어떤 순서로 작업할지, 필요한 참조 자료나 스크립트를 함께 정의합니다.

스킬을 설치해 두면 PR 작성, 구현 계획 수립, 한국어 문서 다듬기처럼 자주 하는 작업에서 매번 기준을 설명하지 않아도 됩니다. 같은 절차와 점검 기준을 꾸준히 적용할 수 있습니다.

## 스킬을 사용하면 좋은 점

- 반복 작업의 절차와 체크리스트를 한 번 정의해 재사용할 수 있습니다.
- 참조 문서와 스크립트를 작업 흐름에 함께 묶어 둘 수 있습니다.
- Codex가 작업 목적에 맞는 기준을 먼저 읽고 일관되게 처리할 수 있습니다.

## `AGENTS.md`와 무엇이 다른가?

| 구분 | 스킬 | `AGENTS.md` |
| --- | --- | --- |
| 역할 | 특정 작업을 어떤 절차로 처리할지 정합니다. | 저장소에서 지켜야 할 규칙과 작업 방식을 정합니다. |
| 적용 시점 | 요청이 스킬 설명과 맞거나 스킬 이름을 직접 지정했을 때 사용합니다. | Codex가 작업을 시작하기 전에 현재 작업 경로의 지침으로 읽습니다. |
| 잘 맞는 내용 | PR 작성, 문서 다듬기, 구현 계획처럼 반복되는 작업 흐름 | 코드 스타일, 테스트 명령, 디렉터리별 제약, PR 전 확인 사항 |

둘은 함께 쓰는 것이 좋습니다. `AGENTS.md`에는 이 저장소에서 따라야 할 공통 규칙을 두고, 스킬에는 특정 작업을 처리하는 재사용 가능한 워크플로우를 둡니다.

## Codex에서 스킬 사용하기

Codex는 스킬 이름과 설명을 보고 요청에 맞는 스킬을 찾습니다. 꼭 사용하고 싶은 스킬이 있다면 요청에 이름을 직접 적으면 됩니다.

### Codex CLI

작업할 저장소에서 Codex를 실행한 뒤, 채팅에 작업을 요청합니다.

```bash
cd my-project
codex
```

```text
global-humanize-korean 스킬을 사용해서 README의 한국어 문장을 다듬어줘.
```

### Codex 앱

Codex 앱에서 대상 저장소를 열고 작업 내용을 입력합니다. CLI와 마찬가지로 스킬 이름을 함께 적으면 원하는 워크플로우를 바로 지정할 수 있습니다.

```text
global-branch-planning-pipeline 스킬을 사용해서 이슈를 만들고 PR까지 준비해줘.
```

## 설치, 업데이트 및 삭제

```bash
# 최초 설치: Codex 전역에 모든 스킬 설치
npx skills add indextrown/codex-skillbook --skill '*' --agent codex --global --yes

# 이후 전체 업데이트
npx skills update --global

# 특정 스킬만 업데이트
npx skills update --global global-humanize-korean

# 특정 스킬 삭제
npx skills remove global-humanize-korean --agent codex --global --yes
```

## 자주 사용하는 스킬

| 한글 제목 | 스킬 | 설명 |
| --- | --- | --- |
| 이슈·브랜치·PR 파이프라인 | [global-branch-planning-pipeline](./skills/global-branch-planning-pipeline/SKILL.md) | 이슈 생성부터 브랜치, 구현, 커밋, PR까지의 작업 흐름을 일관되게 관리합니다. |
| 한국어 문체 다듬기 | [global-humanize-korean](./skills/global-humanize-korean/SKILL.md) | 의미와 사실은 유지하면서 AI 번역투와 기계적인 문장을 자연스러운 한국어로 다듬습니다. |
| 구현 계획 수립 | [global-planning-pipeline](./skills/global-planning-pipeline/SKILL.md) | 구현 전에 작업 계획, 방향성, 리팩터링 접근 방법을 검토하고 정리합니다. |
| 기술 문서 작성 | [global-technical-writing](./skills/global-technical-writing/SKILL.md) | 기술 문서를 구조화하고, 명확하고 자연스러운 한국어 문체로 작성하거나 다듬습니다. |

## 레거시 스킬

| 한글 제목 | 스킬 | 설명 |
| --- | --- | --- |
| 스킬 찾기 | [find-skills](./legacy/find-skills/SKILL.md) | 필요한 기능을 제공하는 설치 가능한 스킬을 찾고 설치할 수 있게 돕습니다. |
| 코드 질문·원인 분석 | [global-ask](./legacy/global-ask/SKILL.md) | 코드 변경 없이 오류와 경고의 원인을 분석하고, 개선 방향이나 학습 방법을 안내합니다. |
| 자동 커밋·푸시 | [global-auto-commit](./legacy/global-auto-commit/SKILL.md) | 변경사항을 점검하고 저장소 규칙에 맞춰 커밋하며, 필요하면 푸시까지 진행합니다. |
| GitHub 이슈 작성 | [global-auto-issue](./legacy/global-auto-issue/SKILL.md) | 문제 상황과 저장소 규칙을 바탕으로 GitHub 이슈를 작성하고 등록합니다. |
| GitHub PR 생성 | [global-auto-pr](./legacy/global-auto-pr/SKILL.md) | 현재 브랜치의 변경사항을 바탕으로 GitHub 풀 리퀘스트를 작성하고 생성합니다. |
| PR 준비 | [global-pr-prep](./legacy/global-pr-prep/SKILL.md) | PR에 필요한 브랜치명, 변경 요약, 커밋·푸시 명령, 제목과 본문을 준비합니다. |
