# codex-skillbook

전역 Codex 스킬을 한곳에 모아 관리합니다. 각 스킬 이름을 선택하면 상세 워크플로우를 확인할 수 있습니다.

## 설치 및 업데이트

```bash
# 최초 설치: Codex 전역에 모든 스킬 설치
npx skills add indextrown/codex-skillbook --skill '*' --agent codex --global --yes

# 이후 전체 업데이트
npx skills update --global

# 특정 스킬만 업데이트
npx skills update --global global-humanize-korean
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
