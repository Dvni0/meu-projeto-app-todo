export type ExamTone = 'coral' | 'blue' | 'green' | 'gold'

export interface ChecklistItem {
  id: string
  title: string
  completed: boolean
}

export interface StudyMaterial {
  title: string
  url: string
}

export interface StudyExam {
  id: string
  classroomId: string
  title: string
  subject: string
  date: string
  time: string
  room: string
  teacher: string
  weight: number
  content: string
  tone: ExamTone
  checklist: ChecklistItem[]
  materials: StudyMaterial[]
}