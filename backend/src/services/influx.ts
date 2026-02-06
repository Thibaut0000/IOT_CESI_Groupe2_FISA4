import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { BucketsAPI, OrgsAPI } from "@influxdata/influxdb-client-apis";
import { config } from "../config.js";
import { logger } from "../logger.js";

const influx = new InfluxDB({ url: config.influx.url, token: config.influx.token });

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const getWriteApi = () =>
  influx.getWriteApi(config.influx.org, config.influx.bucket, "ms");

const getQueryApi = () => influx.getQueryApi(config.influx.org);

/* ------------------------------------------------------------------ */
/*  Init – ensure buckets exist                                       */
/* ------------------------------------------------------------------ */

export const initInflux = async () => {
  try {
    const orgsApi = new OrgsAPI(influx);
    const orgs = await orgsApi.getOrgs({ org: config.influx.org });
    const orgId = orgs.orgs?.[0]?.id;
    if (!orgId) {
      logger.error({ msg: "influx org not found", org: config.influx.org });
      return;
    }

    const bucketsApi = new BucketsAPI(influx);
    const buckets = await bucketsApi.getBuckets({ orgID: orgId, name: config.influx.bucket });
    if (!buckets.buckets || buckets.buckets.length === 0) {
      await bucketsApi.postBuckets({
        body: { orgID: orgId, name: config.influx.bucket, retentionRules: [] }
      });
      logger.info({ msg: "influx bucket created", bucket: config.influx.bucket });
    }

    // Ensure meta bucket for users / thresholds / audit
    const metaBuckets = await bucketsApi.getBuckets({ orgID: orgId, name: "meta" });
    if (!metaBuckets.buckets || metaBuckets.buckets.length === 0) {
      await bucketsApi.postBuckets({
        body: { orgID: orgId, name: "meta", retentionRules: [] }
      });
      logger.info({ msg: "influx meta bucket created" });
    }

    logger.info({ msg: "influx ready" });
  } catch (err) {
    logger.error({ msg: "influx init failed", err });
  }
};

/* ------------------------------------------------------------------ */
/*  Noise data                                                        */
/* ------------------------------------------------------------------ */

export const writeNoisePoint = async (deviceId: string, noiseDb: number, tsMs: number) => {
  const writeApi = getWriteApi();
  const point = new Point("noise")
    .tag("device", deviceId)
    .floatField("value", noiseDb)
    .timestamp(new Date(tsMs));
  writeApi.writePoint(point);
  await writeApi.flush();
};

export const queryLatest = async (deviceId: string) => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "noise" and r.device == "${deviceId}")
      |> last()
  `;
  const results = await queryApi.collectRows(q);
  if (results.length === 0) return null;
  const row = results[0] as { _time: string; _value: number };
  return { _time: row._time, _value: row._value };
};

export const queryHistory = async (deviceId: string, minutes: number) => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: -${minutes}m)
      |> filter(fn: (r) => r._measurement == "noise" and r.device == "${deviceId}")
      |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  `;
  const results = await queryApi.collectRows(q);
  return results.map((row: unknown) => {
    const r = row as { _time: string; _value: number };
    return { _time: r._time, _value: r._value };
  });
};

export const queryStats = async (deviceId: string, minutes: number) => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: -${minutes}m)
      |> filter(fn: (r) => r._measurement == "noise" and r.device == "${deviceId}")
      |> keep(columns: ["_value"])
      |> reduce(
        identity: { count: 0.0, sum: 0.0, min: 999999.0, max: 0.0 },
        fn: (r, accumulator) => ({
          count: accumulator.count + 1.0,
          sum: accumulator.sum + r._value,
          min: if r._value < accumulator.min then r._value else accumulator.min,
          max: if r._value > accumulator.max then r._value else accumulator.max
        })
      )
  `;
  const results = await queryApi.collectRows(q);
  if (results.length === 0) return null;
  const row = results[0] as { count: number; sum: number; min: number; max: number };
  const avg = row.count > 0 ? row.sum / row.count : 0;
  return { min: row.min, max: row.max, avg: Math.round(avg * 10) / 10, count: row.count };
};

/* ------------------------------------------------------------------ */
/*  Users (stored in "meta" bucket, measurement "users")              */
/* ------------------------------------------------------------------ */

const metaBucket = "meta";

export const writeUser = async (
  email: string,
  passwordHash: string,
  role: string
) => {
  const writeApi = influx.getWriteApi(config.influx.org, metaBucket, "ms");
  const point = new Point("users")
    .tag("email", email)
    .stringField("password_hash", passwordHash)
    .stringField("role", role);
  writeApi.writePoint(point);
  await writeApi.flush();
};

export const queryUser = async (
  email: string
): Promise<{ email: string; password_hash: string; role: string } | null> => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${metaBucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "users" and r.email == "${email}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
  `;
  const results = await queryApi.collectRows(q);
  if (results.length === 0) return null;
  const row = results[0] as { email: string; password_hash: string; role: string };
  return { email: row.email, password_hash: row.password_hash, role: row.role };
};

/* ------------------------------------------------------------------ */
/*  Thresholds (stored in "meta" bucket, measurement "thresholds")    */
/* ------------------------------------------------------------------ */

export const writeThreshold = async (
  deviceId: string | null,
  thresholdDb: number
) => {
  const writeApi = influx.getWriteApi(config.influx.org, metaBucket, "ms");
  const tag = deviceId ?? "__global__";
  const point = new Point("thresholds")
    .tag("device", tag)
    .floatField("threshold_db", thresholdDb);
  writeApi.writePoint(point);
  await writeApi.flush();
};

export const queryThresholds = async (): Promise<
  Array<{ deviceId: string | null; thresholdDb: number }>
> => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${metaBucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "thresholds" and r._field == "threshold_db")
      |> last()
      |> group()
  `;
  const results = await queryApi.collectRows(q);
  return results.map((row: unknown) => {
    const r = row as { device: string; _value: number };
    return {
      deviceId: r.device === "__global__" ? null : r.device,
      thresholdDb: r._value
    };
  });
};

export const queryThresholdForDevice = async (
  deviceId: string
): Promise<number | null> => {
  const queryApi = getQueryApi();
  // Try device-specific first
  const qDevice = `
    from(bucket: "${metaBucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "thresholds" and r.device == "${deviceId}" and r._field == "threshold_db")
      |> last()
  `;
  let results = await queryApi.collectRows(qDevice);
  if (results.length > 0) {
    const row = results[0] as { _value: number };
    return row._value;
  }
  // Fallback to global
  const qGlobal = `
    from(bucket: "${metaBucket}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "thresholds" and r.device == "__global__" and r._field == "threshold_db")
      |> last()
  `;
  results = await queryApi.collectRows(qGlobal);
  if (results.length > 0) {
    const row = results[0] as { _value: number };
    return row._value;
  }
  return null;
};

/* ------------------------------------------------------------------ */
/*  Audit logs (stored in "meta" bucket, measurement "audit")         */
/* ------------------------------------------------------------------ */

export const writeAuditPoint = async (
  action: string,
  actor: string,
  data?: Record<string, unknown>
) => {
  const writeApi = influx.getWriteApi(config.influx.org, metaBucket, "ms");
  const point = new Point("audit")
    .tag("action", action)
    .tag("actor", actor)
    .stringField("data", data ? JSON.stringify(data) : "{}");
  writeApi.writePoint(point);
  await writeApi.flush();
};

export const queryAuditLogs = async (limit = 100) => {
  const queryApi = getQueryApi();
  const q = `
    from(bucket: "${metaBucket}")
      |> range(start: -30d)
      |> filter(fn: (r) => r._measurement == "audit" and r._field == "data")
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: ${limit})
  `;
  const results = await queryApi.collectRows(q);
  return results.map((row: unknown) => {
    const r = row as { _time: string; action: string; actor: string; _value: string };
    return {
      action: r.action,
      actor: r.actor,
      data: r._value ? JSON.parse(r._value) : null,
      created_at: r._time
    };
  });
};