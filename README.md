# China ADAS Incident Database / 中国 ADAS 事故数据库

The live database, report filters, account-based voting, and daily updates have moved to the [home-hosted web application](https://win-dlf0f69f65u.tail68f4a2.ts.net/). Viewing reports requires an invitation and administrator approval. The service is available while its home computer, internet connection, and Tailscale Funnel are online.

This repository is a historical public snapshot. Its checked-in `data/reports.json` and `site/data/reports.json` are no longer automatically updated or used as the live database. The former static UI has been replaced by a landing page pointing to the new application. Earlier versions remain in Git history and release tags.

The [Updater repository](https://github.com/fengguode/CN_Vehicle_Accident_Updater) owns the collector, importer, SQLite schema, API, UI, SVM filtering, and local operating procedures. Reports are leads, not findings that ADAS caused an incident. The `verification_status` field distinguishes unverified leads from human-verified records.

中国 ADAS 事故数据库的实时内容、筛选、投票和每日更新已迁移至[本地托管网页](https://win-dlf0f69f65u.tail68f4a2.ts.net/)。查看报告需要邀请码和管理员批准。本仓库保留为历史公开快照，不再自动发布新数据。
