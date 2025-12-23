import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { CreditScore } from "./entities/credit-score.entity"
import { CreditScoreService } from "./credit-score.service"
import { CreditScoreController } from "./credit-score.controller"
import { TraditionalCreditCalculator } from "./calculators/traditional-credit.calculator"
import { CreditScoreProcessor } from "./processors/credit-score.processor"
import { UserModule } from "../user/user.module"

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditScore]),
    BullModule.registerQueue({
      name: "credit-score-calculation",
    }),
    UserModule,
  ],
  providers: [CreditScoreService, TraditionalCreditCalculator, CreditScoreProcessor],
  controllers: [CreditScoreController],
  exports: [CreditScoreService, TraditionalCreditCalculator],
})
export class CreditScoreModule {}
