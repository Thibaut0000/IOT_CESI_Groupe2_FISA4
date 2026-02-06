import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config.js";

const influx = new InfluxDB({ url: config.influx.url, token: config.influx.token });
const queryApi = influx.getQueryApi(config.influx.org);

const run = async () => {
  console.log("Checking InfluxDB connection...");
  console.log("URL:", config.influx.url);
  console.log("Org:", config.influx.org);
  console.log("Bucket:", config.influx.bucket);

  try {
    const q = `
      from(bucket: "${config.influx.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "noise")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 5)
    `;
    const results = await queryApi.collectRows(q);
    console.log(`noise_history count (last 1h): ${results.length}`);
    if (results.length > 0) {
      console.log("Last records:", JSON.stringify(results, null, 2));
    }
  } catch (e) {
    console.error("InfluxDB query failed:", e);
  }
};

run();
