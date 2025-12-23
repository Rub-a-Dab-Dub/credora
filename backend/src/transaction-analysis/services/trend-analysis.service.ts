import { Injectable } from "@nestjs/common"
import { TimeSeriesAnalysisService } from "./time-series-analysis.service"

/**
 * Compatibility shim: some parts of the code reference TrendAnalysisService.
 * Delegate to TimeSeriesAnalysisService to avoid breaking changes.
 */
@Injectable()
export class TrendAnalysisService extends TimeSeriesAnalysisService {}
