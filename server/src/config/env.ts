import dotenv from 'dotenv';
import path from 'path';
// Imported first in index.ts so every module sees env values at import time.
// Reads the single repo-root .env (same depth from src/config and dist/config). On Render there is no file; the dashboard sets env.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
