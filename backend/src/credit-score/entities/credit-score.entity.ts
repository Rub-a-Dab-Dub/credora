import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { User } from "../../user/entities/user.entity"
import { MlModel } from "../../ml-model/entities/ml-model.entity"

export enum CreditGrade {
  EXCELLENT = "A+",
  VERY_GOOD = "A",
  GOOD = "B+",
  FAIR = "B",
  POOR = "C",
  VERY_POOR = "D",
}

@Entity("credit_scores")
@Index(["userId", "createdAt"])
export class CreditScore {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column("uuid")
  userId: string

  @ManyToOne(
    () => User,
    (user) => user.creditScores,
  )
  @JoinColumn({ name: "userId" })
  user: User

  @Column({ type: "int" })
  score: number // 300-850 range

  @Column({ type: "enum", enum: CreditGrade })
  grade: CreditGrade

  @Column({ type: "decimal", precision: 5, scale: 4 })
  confidence: number // 0-1 confidence score

  @Column("uuid")
  modelId: string

  @ManyToOne(() => MlModel)
  @JoinColumn({ name: "modelId" })
  model: MlModel

  @Column({ type: "json" })
  scoringFactors: {
    category: string
    impact: number
    description: string
    weight: number
  }[]

  @Column({ type: "json" })
  inputData: {
    traditional: any
    defi: any
    onChain: any
    alternative: any
  }

  @Column({ type: "json", nullable: true })
  explanation: {
    primaryFactors: string[]
    improvementSuggestions: string[]
    riskAssessment: string
  }

  @Column({ type: "decimal", precision: 5, scale: 2 })
  traditionalWeight: number

  @Column({ type: "decimal", precision: 5, scale: 2 })
  defiWeight: number

  @Column({ type: "decimal", precision: 5, scale: 2 })
  onChainWeight: number

  @Column({ type: "decimal", precision: 5, scale: 2 })
  alternativeWeight: number

  @CreateDateColumn()
  createdAt: Date
}
