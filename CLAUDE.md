# CLAUDE.md

## Project Information
Project Controls system for engineering schedules (P6 Integration).

- **Backend**: FastAPI (Python 3.8+), SQLAlchemy, MySQL, Redis.
- **Frontend**: React (TypeScript), Vite, Ant Design.

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
- **Calculate & Sync**: `python run_sync_and_calculate.py`

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
