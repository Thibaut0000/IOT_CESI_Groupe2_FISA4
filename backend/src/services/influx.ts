import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { config } from "../config.js";

const influx = new InfluxDB({ url: config.influx.url, token: config.influx.token });

export const writeNoisePoint = async (deviceId: string, noiseDb: number, tsMs: number) => {
  const writeApi = influx.getWriteApi(config.influx.org, config.influx.bucket);
  const point = new Point("noise")
    .tag("device", deviceId)
    .floatField("value", noiseDb)
    .timestamp(new Date(tsMs));
  writeApi.writePoint(point);
  await writeApi.flush();
};

export const queryLatest = async (deviceId: string) => {
  const queryApi = influx.getQueryApi(config.influx.org);
  const flux = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "noise" and r.device == "${deviceId}")
      |> last()
  `;

  const results = await queryApi.collectRows(flux);
  if (results.length === 0) return null;
  const row = results[0] as { _time: string; _value: number };
  return { _time: row._time, _value: row._value };
};

export const queryHistory = async (deviceId: string, minutes: number) => {
  const queryApi = influx.getQueryApi(config.influx.org);
  const flux = `
    from(bucket: "${config.influx.bucket}")
      |> range(start: -${minutes}m)
      |> filter(fn: (r) => r._measurement == "noise" and r.device == "${deviceId}")
      |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
      |> yield(name: "mean")
  `;

  const results = await queryApi.collectRows(flux);
  return results.map((row: unknown) => {
    const r = row as { _time: string; _value: number };
    return { _time: r._time, _value: r._value };
  });
};

export const queryStats = async (deviceId: string, minutes: number) => {
  const queryApi = influx.getQueryApi(config.influx.org);
  const flux = `
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

  const results = await queryApi.collectRows(flux);
  if (results.length === 0) return null;
  const row = results[0] as { count: number; sum: number; min: number; max: number };
  const avg = row.count > 0 ? row.sum / row.count : 0;
  return { min: row.min, max: row.max, avg };
};