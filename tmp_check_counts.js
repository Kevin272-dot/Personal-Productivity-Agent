const { getPrismaClient } = require('./lib/prisma');

(async () => {
  const db = getPrismaClient();

  const rows = await db`
    select 'users' as table_name, count(*)::int as count from users
    union all select 'daily_plans', count(*)::int from daily_plans
    union all select 'tasks', count(*)::int from tasks
    union all select 'focus_sessions', count(*)::int from focus_sessions
    union all select 'reminder_history', count(*)::int from reminder_history
    order by table_name
  `;

  console.log(JSON.stringify(rows, null, 2));
  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
