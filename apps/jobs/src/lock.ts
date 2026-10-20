import type pg from "pg";

export async function runWithLock(
  pool: pg.Pool,
  jobName: string,
  work: () => Promise<void>,
): Promise<"ran" | "skipped"> {
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as locked",
      [jobName],
    );
    if (!lock.rows[0]?.locked) {
      await client.query(
        `insert into job_runs (job_name, window_start, window_end, state, attempts, completed_at)
         values ($1, now(), now(), 'skipped', 1, now())`,
        [jobName],
      );
      return "skipped";
    }
    try {
      await work();
      await client.query(
        `insert into job_runs (job_name, window_start, window_end, state, attempts, completed_at)
         values ($1, now(), now(), 'succeeded', 1, now())`,
        [jobName],
      );
      return "ran";
    } catch (error) {
      await client.query(
        `insert into job_runs (job_name, window_start, window_end, state, attempts, completed_at)
         values ($1, now(), now(), 'failed', 1, now())`,
        [jobName],
      );
      throw error;
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [jobName]);
    }
  } finally {
    client.release();
  }
}
