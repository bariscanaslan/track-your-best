-- Runs once on first container start.
-- Creates extensions and schemas before EF Core migrations run.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS tyb_core;
CREATE SCHEMA IF NOT EXISTS tyb_spatial;
CREATE SCHEMA IF NOT EXISTS tyb_analytics;
