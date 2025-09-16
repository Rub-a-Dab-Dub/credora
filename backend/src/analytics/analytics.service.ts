import { Injectable, Inject } from '@nestjs/common';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { INFLUXDB_CLIENT } from '../influxdb/influxdb.module';
import * as ss from 'simple-statistics';

@Injectable()
export class AnalyticsService {
  constructor(
    // We inject the InfluxDB client we created in the previous step.
    @Inject(INFLUXDB_CLIENT) private readonly influxDB: InfluxDB,
  ) {}

  // These settings match our docker-compose.yml file.
  private readonly org = process.env.INFLUXDB_ORG || 'my-org';
  private readonly bucket = process.env.INFLUXDB_BUCKET || 'analytics';

  /**
   * Tracks a single event. This is the core of our ETL pipeline.
   * @param measurement - The name of the "table" in InfluxDB (e.g., 'kyc_events', 'api_usage').
   * @param tags - Key-value pairs that will be indexed for fast queries (e.g., { step: 'started', country: 'NG' }).
   * @param fields - The actual data points for the event (e.g., { userId: '123', processingTime: 55.4 }).
   */
  async track(measurement: string, tags: Record<string, string>, fields: Record<string, any>) {
    // Get an API client for writing data.
    const writeApi = this.influxDB.getWriteApi(this.org, this.bucket);

    // Create a new "Point" which represents a single row of data in InfluxDB.
    const point = new Point(measurement);

    // Attach all the indexed tags.
    for (const key in tags) {
      point.tag(key, tags[key]);
    }

    // Attach all the data fields, correctly assigning their data type.
    for (const key in fields) {
      const value = fields[key];
      if (typeof value === 'number' && Number.isInteger(value)) {
        point.intField(key, value);
      } else if (typeof value === 'number') {
        point.floatField(key, value);
      } else if (typeof value === 'boolean') {
        point.booleanField(key, value);
      } else {
        point.stringField(key, String(value));
      }
    }

    // Write the point to the database.
    writeApi.writePoint(point);

    // Close the connection to flush the data.
    await writeApi.close();
    console.log(`Tracked event '${measurement}' with tags: ${JSON.stringify(tags)}`);
  }

  /**
   * Analyzes the KYC conversion funnel by querying InfluxDB.
   */
  async getKycFunnelAnalysis() {
    const queryApi = this.influxDB.getQueryApi(this.org);
    // Flux is InfluxDB's query language. This query finds all 'kyc_events'
    // in the last 30 days, groups them by the 'step' tag, and counts them.
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "kyc_events")
        |> group(columns: ["step"])
        |> count()
        |> group()
    `;

    const result: { step: string, count: number }[] = [];
    // We process the streamed results from the database.
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          result.push({ step: o.step, count: o._value });
        },
        error(error) {
          console.error(error);
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });
    return result;
  }

  /**
   * Analyzes the distribution of user credit scores.
   */
  async getCreditScoreDistribution() {
    const queryApi = this.influxDB.getQueryApi(this.org);
    // This query gets the most recent credit score for every user.
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "user_profiles" and r._field == "creditScore")
        |> last()
    `;

    const scores: number[] = [];
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          scores.push(o._value);
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve();
        },
      });
    });

    if (scores.length === 0) {
      return { message: "No credit score data found." };
    }

    // We use a statistical library to analyze the raw scores.
    return {
      count: scores.length,
      mean: ss.mean(scores),
      median: ss.median(scores),
      stdDev: ss.standardDeviation(scores),
      min: ss.min(scores),
      max: ss.max(scores),
    };
  }
}

