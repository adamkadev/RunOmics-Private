import type { WorkoutPrescription } from '@/domain/coaching/types'

export interface WorkoutPublicationResult {
  prescriptionId: string
  status: 'published' | 'skipped' | 'failed'
  externalId?: string
  reason?: string
}

export interface WorkoutPublisher {
  publish(workouts: WorkoutPrescription[]): Promise<WorkoutPublicationResult[]>
}
