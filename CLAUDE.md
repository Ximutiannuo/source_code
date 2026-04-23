# CLAUDE.md

## Project Information
Mechanical manufacturing digital platform transitioning from a project-controls tool into an ERP/MES system.

- **Backend**: FastAPI (Python 3.8+), SQLAlchemy, MySQL, Redis.
- **Frontend**: React (TypeScript), Vite, Ant Design.

## Strategic Direction
- The current strategic goal is ERP evolution: move from progress-only management to integrated management of logistics and cash flow.
- Legacy P6 and engineering schedule modules are no longer the primary direction. Do not expand P6-first designs unless the user explicitly asks for legacy maintenance.
- New models, services, and APIs must prioritize end-to-end business flow across BOM, procurement, inventory, manufacturing execution, and cost accounting.
- Every new or changed transactional data model must include financial attributes when meaningful, such as `unit_price`, `total_price`, `tax_rate`, `fee_rate`, or equivalent cost fields.
- Every material and inventory design must represent lifecycle quantities or statuses when meaningful, including `reserved`, `in_transit`, `on_hand`, and `consumed`.
- Prefer canonical data links that let BOM demand drive procurement, procurement drive receiving, inventory drive issue and return, and execution data drive cost roll-up.

## Common Commands
### Backend
- **Run (Development)**: `python backend/run.py` (Starts on port 8001)
- **Direct Run**: `uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`
- **Register Service**: `powershell -ExecutionPolicy Bypass -File Register-Sync-Service.ps1`
- **Database Test**: `python backend/test_db_simple.py`

### Frontend
- **Run (Development)**: `npm run dev` (Starts on port 3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint`

### Data Sync
- **Calculate & Sync**: `python run_sync_and_calculate.py` (legacy)

## Guidelines (Karpathy-Skills)
*Source: C:\Users\王白东\.gemini\antigravity\skills\karpathy-skills*

### 1. Think Before Coding
- **Don't assume.** State assumptions explicitly. If uncertain, ask.
- **Surface tradeoffs.** If multiple interpretations exist, present them.
- **Ask for clarification.** If something is unclear, stop and ask.

### 2. Simplicity First
- **Minimum code** that solves the problem. Nothing speculative.
- No abstractions for single-use code.
- No "flexibility" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- **Touch only what you must.** Clean up only your own mess.
- Don't "improve" adjacent code/comments/formatting unless requested.
- Match existing style.

### 4. Goal-Driven Execution
- **Define success criteria.** Loop until verified.
- Multi-step tasks should have a brief plan:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
