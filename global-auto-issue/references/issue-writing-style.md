# Generic Issue Writing Style

이 문서는 `global-auto-issue`가 여러 저장소에서 일관된 GitHub Issue를 작성하기 위한 기준이다. 저장소에 이슈 템플릿, CONTRIBUTING 문서, 기존 이슈 관례가 있으면 그 규칙을 이 문서보다 우선한다.

## 제목

제목은 짧고 검색 가능해야 한다.

권장 형식:

```text
[type] 문제 또는 요청 요약
```

좋은 예:

```text
[bug] 로그인 후 세션이 즉시 만료되는 문제
[feature] 관리자 알림 필터를 추가한다
[enhancement] 검색 결과 빈 상태 안내를 개선한다
[docs] 배포 체크리스트에 롤백 절차를 추가한다
```

피해야 할 예:

```text
에러남
수정 필요
앱 이상함
기능 추가
```

## 버그 이슈

버그 이슈는 재현 가능성이 가장 중요하다.

기본 섹션:

```text
## Summary
## Steps to Reproduce
## Expected Behavior
## Actual Behavior
## Environment
## Notes
```

작성 원칙:

- 재현 단계는 번호 목록으로 쓴다.
- 기대 동작과 실제 동작을 분리한다.
- 에러 메시지는 필요한 부분만 짧게 인용한다.
- 환경 정보가 없으면 지어내지 말고 `Not provided`로 둔다.

## 기능 요청 이슈

기능 요청은 사용자 가치와 수용 기준이 중요하다.

기본 섹션:

```text
## Summary
## Background
## Proposal
## Acceptance Criteria
## Notes
```

수용 기준은 체크박스로 쓰면 좋다.

```text
- [ ] 사용자가 <동작>할 수 있다.
- [ ] <상태>일 때 <결과>가 표시된다.
```

## 개선/리팩터링 이슈

개선 이슈는 현재 문제와 영향 범위를 명확히 한다.

기본 섹션:

```text
## Summary
## Current Problem
## Proposed Direction
## Scope / Impact
## Validation
```

## 보안과 개인정보

- 토큰, 키, 비밀번호, 세션값, 실제 사용자 정보는 쓰지 않는다.
- 로그는 필요한 짧은 부분만 붙이고 비밀값은 마스킹한다.
- 불확실한 내용은 사실처럼 쓰지 않는다.
