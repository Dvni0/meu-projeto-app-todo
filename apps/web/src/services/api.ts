export type UserRole = 'student' | 'teacher'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
}

export interface Classroom {
  id: string
  name: string
  subject: string
  join_code?: string
  teacher_name?: string
}

export interface ApiExam {
  id: string
  classroom_id: string
  classroom_name: string
  title: string
  starts_at: string
  weight: string | number
  content: string
  materials: Array<{ title: string; url: string }>
  status: 'scheduled' | 'cancelled'
  subject: string
  teacher_name: string
}

export interface ApiChecklistItem {
  id: string
  exam_id: string
  title: string
  is_completed: boolean
}

export interface ApiNotification {
  id: string
  exam_id: string | null
  title: string
  message: string
  read_at: string | null
  created_at: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

export const SESSION_STORAGE_KEY = 'caderno-academico:session:v1'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') ?? ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const body = payload as { message?: string | string[] }
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : body?.message ?? `A solicitação falhou (${response.status}).`
    throw new ApiError(message, response.status)
  }

  return payload as T
}
