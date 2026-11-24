import dotenv from 'dotenv';
import path from 'path';

// Imported first in index.ts so every module sees env values at import time.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
