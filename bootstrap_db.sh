#!/usr/bin/env bash
set -euo pipefail
psql 'postgresql://neondb_owner:npg_BCXkzr4b2nKL@ep-fancy-bread-ahy48e08-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -v ON_ERROR_STOP=1 -f /home/kevindaniel/productivity_agent/prisma/bootstrap.sql