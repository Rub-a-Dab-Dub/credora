import { Injectable } from "@nestjs/common"

@Injectable()
export class TimeSeriesAnalysisService {
  /**
   * Basic placeholder time-series analysis (moving average).
   * Replace with your domain-specific logic.
   */
  public movingAverage(values: number[], window = 3): number[] {
    if (!Array.isArray(values) || values.length === 0 || window <= 0) return []
    const out: number[] = []
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1)
      const slice = values.slice(start, i + 1)
      out.push(slice.reduce((a, b) => a + b, 0) / slice.length)
    }
    return out
  }
}
