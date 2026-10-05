import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  DoorOpen,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  apiRequest,
  ApiError,
  type ApiChecklistItem,
  type ApiExam,
  type ApiNotification,
  type AuthUser,
  type Classroom,
  type UserRole,
} from '../services/api'
import type { ExamTone, StudyExam, StudyMaterial } from '../types/exam'

type Page = 'overview' | 'exams' | 'calendar' | 'subjects'
type Period = 'all' | 'week' | 'month'

const weekdayLabels = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function todayString(): string {
  return localDateString(new Date())
}

function daysUntil(date: string): number {
  const today = parseLocalDate(todayString()).getTime()
  return Math.round((parseLocalDate(date).getTime() - today) / 86400000)
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(date).toLocaleDateString('pt-BR', options)
}

function relativeDate(date: string): string {
  const distance = daysUntil(date)
  if (distance === 0) return 'Hoje'
  if (distance === 1) return 'Amanhã'
  if (distance < 0) return `Há ${Math.abs(distance)} dias`
  return `Em ${distance} dias`
}

function getToneClass(tone: ExamTone): string {
  return `tone-${tone}`
}

function countChecklist(exams: StudyExam[]) {
  const items = exams.flatMap((exam) => exam.checklist)
  const completed = items.filter((item) => item.completed).length
  return { total: items.length, completed, remaining: items.length - completed }
}

function makeCalendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cellCount = mondayOffset + daysInMonth > 35 ? 42 : 35
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function greeting(): string {
  const hour = new Date().getHours()
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '')
    .join('')
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Não foi possível concluir a operação.'
}

async function loadDashboardData(token: string, user: AuthUser) {
  const [classrooms, apiExams, checklistItems, notifications] = await Promise.all([
    apiRequest<Classroom[]>('/classrooms', token),
    apiRequest<ApiExam[]>('/exams?status=scheduled', token),
    user.role === 'student'
      ? apiRequest<ApiChecklistItem[]>('/checklists', token)
      : Promise.resolve([]),
    apiRequest<ApiNotification[]>('/notifications', token),
  ])
  const checklistByExam = new Map<string, StudyExam['checklist']>()
  for (const item of checklistItems) {
    const items = checklistByExam.get(item.exam_id) ?? []
    items.push({ id: item.id, title: item.title, completed: item.is_completed })
    checklistByExam.set(item.exam_id, items)
  }
  const tones: ExamTone[] = ['coral', 'blue', 'green', 'gold']
  const exams = apiExams.map((exam) => {
    const startsAt = new Date(exam.starts_at)
    if (Number.isNaN(startsAt.getTime())) {
      throw new Error(`A avaliação "${exam.title}" possui uma data inválida.`)
    }
    const toneIndex = [...exam.subject].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length
    return {
      id: exam.id,
      classroomId: exam.classroom_id,
      title: exam.title,
      subject: exam.subject,
      date: localDateString(startsAt),
      time: startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      room: exam.classroom_name,
      teacher: exam.teacher_name,
      weight: Number(exam.weight),
      content: exam.content,
      tone: tones[toneIndex],
      checklist: checklistByExam.get(exam.id) ?? [],
      materials: exam.materials ?? [],
    } satisfies StudyExam
  })
  return { classrooms, exams, notifications }
}

function StudentDashboard({
  user,
  token,
  onSignOut,
  onSessionExpired,
}: {
  user: AuthUser
  token: string
  onSignOut: () => void
  onSessionExpired: () => void
}) {
  const [exams, setExams] = useState<StudyExam[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState<Page>('overview')
  const [period, setPeriod] = useState<Period>('week')
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1, 12)
  })
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingExam, setEditingExam] = useState<StudyExam | null>(null)
  const [showClassroomModal, setShowClassroomModal] = useState(false)
  const [showReminders, setShowReminders] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true
    loadDashboardData(token, user)
      .then((data) => {
        if (!active) return
        setExams(data.exams)
        setClassrooms(data.classrooms)
        setNotifications(data.notifications)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) {
          onSessionExpired()
          return
        }
        setError(errorMessage(reason))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, user, onSessionExpired])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const subjects = Array.from(new Set([
    ...classrooms.map((classroom) => classroom.subject),
    ...exams.map((exam) => exam.subject),
  ])).sort()
  const unreadCount = notifications.filter((notification) => !notification.read_at).length
  const checklistStats = countChecklist(exams)
  const completedPercent = checklistStats.total
    ? Math.round((checklistStats.completed / checklistStats.total) * 100)
    : 0
  const filteredExams = exams
    .filter((exam) => {
      const text = `${exam.title} ${exam.subject} ${exam.teacher}`.toLocaleLowerCase('pt-BR')
      const matchesQuery = text.includes(query.trim().toLocaleLowerCase('pt-BR'))
      const matchesSubject = !subjectFilter || exam.subject === subjectFilter
      const matchesDate = !dateFilter || exam.date === dateFilter
      const distance = daysUntil(exam.date)
      const matchesPeriod =
        period === 'all' ||
        (period === 'week' && distance >= 0 && distance <= 7) ||
        (period === 'month' && distance >= 0 && distance <= 30)
      return matchesQuery && matchesSubject && matchesDate && matchesPeriod
    })
    .sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`))

  const selectedExam = exams.find((exam) => exam.id === selectedExamId) ?? null
  const upcomingExams = [...exams]
    .filter((exam) => daysUntil(exam.date) >= 0)
    .sort((first, second) => first.date.localeCompare(second.date))
  const monthlyExams = upcomingExams.filter((exam) => daysUntil(exam.date) <= 30)
  const titleByPage: Record<Page, string> = {
    overview: `${greeting()}, ${user.name.split(' ')[0]}.`,
    exams: 'Suas avaliações',
    calendar: 'Calendário acadêmico',
    subjects: 'Suas disciplinas',
  }

  function changePage(nextPage: Page) {
    setPage(nextPage)
    setSubjectFilter('')
    setDateFilter('')
    setQuery('')
    if (nextPage === 'overview') setPeriod('week')
    if (nextPage === 'exams' || nextPage === 'subjects') setPeriod('all')
  }

  async function refreshDashboard() {
    const data = await loadDashboardData(token, user)
    setExams(data.exams)
    setClassrooms(data.classrooms)
    setNotifications(data.notifications)
  }

  async function runAction(action: () => Promise<void>) {
    if (isSaving) return
    setError('')
    setIsSaving(true)
    try {
      await action()
      await refreshDashboard()
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        onSessionExpired()
        return
      }
      setError(errorMessage(reason))
    } finally {
      setIsSaving(false)
    }
  }

  function toggleChecklistItem(itemId: string) {
    const item = exams.flatMap((exam) => exam.checklist).find((checklistItem) => checklistItem.id === itemId)
    if (!item) return
    void runAction(async () => {
      await apiRequest(`/checklists/${item.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: !item.completed }),
      })
    })
  }

  function addChecklistItem(exam: StudyExam, title: string) {
    void runAction(async () => {
      await apiRequest('/checklists', token, {
        method: 'POST',
        body: JSON.stringify({ examId: exam.id, title }),
      })
    })
  }

  function removeChecklistItem(itemId: string) {
    void runAction(async () => {
      await apiRequest(`/checklists/${itemId}`, token, { method: 'DELETE' })
    })
  }

  function saveExam(exam: { classroomId: string; title: string; startsAt: string; weight: number; content: string; materials: Array<{ title: string; url: string }> }, examId?: string) {
    void runAction(async () => {
      if (examId) {
        const updates = {
          title: exam.title,
          startsAt: exam.startsAt,
          weight: exam.weight,
          content: exam.content,
          materials: exam.materials,
        }
        await apiRequest(`/exams/${examId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      } else {
        await apiRequest('/exams', token, {
          method: 'POST',
          body: JSON.stringify(exam),
        })
      }
      setShowAddModal(false)
      setEditingExam(null)
      setPage('exams')
      setPeriod('all')
    })
  }

  function cancelExam(examId: string) {
    void runAction(async () => {
      await apiRequest(`/exams/${examId}`, token, { method: 'DELETE' })
      setSelectedExamId(null)
    })
  }

  function saveClassroom(payload: { name: string; subject: string } | { code: string }) {
    void runAction(async () => {
      if ('code' in payload) {
        await apiRequest('/classrooms/join', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        await apiRequest('/classrooms', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setPage('subjects')
        setPeriod('all')
      }
      setShowClassroomModal(false)
    })
  }

  function markNotificationRead(notification: ApiNotification) {
    if (!notification.read_at) {
      void apiRequest<ApiNotification>(`/notifications/${notification.id}/read`, token, { method: 'PATCH' })
        .then((updated) => setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item)))
        .catch((reason: unknown) => {
          if (reason instanceof ApiError && reason.status === 401) {
            onSessionExpired()
            return
          }
          setError(errorMessage(reason))
        })
    }
    if (notification.exam_id && exams.some((exam) => exam.id === notification.exam_id)) {
      setSelectedExamId(notification.exam_id)
    }
    setShowReminders(false)
  }

  function openPrimaryAction() {
    if (user.role === 'student' || classrooms.length === 0) {
      setShowClassroomModal(true)
      return
    }
    setEditingExam(null)
    setShowAddModal(true)
  }

  function navigateMonth(offset: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12))
  }

  const periodOptions: { id: Period; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'week', label: 'Esta semana' },
    { id: 'month', label: 'Este mês' },
  ]

  return (
    <div className="planner-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="Caderno">
          <span className="brand-mark"><BookOpenCheck size={20} strokeWidth={2.2} /></span>
          <span className="brand-name">caderno<span>.</span></span>
        </div>

        <div className="student-card">
          <div className="student-avatar">{getInitials(user.name)}</div>
          <div className="student-meta">
            <strong>{user.name}</strong>
            <span>{user.role === 'teacher' ? 'Professor(a)' : `${classrooms.length} turmas conectadas`}</span>
          </div>
          <ChevronRight size={15} className="student-chevron" />
        </div>

        <p className="sidebar-label">ESPAÇO DE ESTUDOS</p>
        <nav className="primary-nav" aria-label="Navegação principal">
          <NavItem
            active={page === 'overview'}
            icon={<LayoutDashboard size={18} />}
            label="Visão geral"
            onClick={() => changePage('overview')}
          />
          <NavItem
            active={page === 'exams'}
            icon={<ListChecks size={18} />}
            label="Avaliações"
            count={upcomingExams.length}
            onClick={() => changePage('exams')}
          />
          <NavItem
            active={page === 'calendar'}
            icon={<CalendarDays size={18} />}
            label="Calendário"
            onClick={() => changePage('calendar')}
          />
          <NavItem
            active={page === 'subjects'}
            icon={<GraduationCap size={18} />}
            label="Disciplinas"
            onClick={() => changePage('subjects')}
          />
        </nav>

        <div className="sidebar-bottom">
          {user.role === 'student' && <div className="weekly-goal">
            <div className="goal-heading">
              <span className="goal-icon"><Sparkles size={15} /></span>
              <span>Seu ritmo</span>
              <span className="goal-value">{completedPercent}%</span>
            </div>
            <div className="goal-track" aria-label={`${completedPercent}% das tarefas concluídas`}>
              <span style={{ width: `${completedPercent}%` }} />
            </div>
            <p>{checklistStats.completed} de {checklistStats.total} etapas concluídas</p>
          </div>}
          {user.role === 'teacher' && (
            <button type="button" className="sidebar-action" onClick={() => setShowClassroomModal(true)}>
              <Plus size={15} /> Nova turma
            </button>
          )}
          <div className="sidebar-footer"><span className="online-dot" /><span>Sincronizado com sua conta</span></div>
          <button type="button" className="sidebar-signout" onClick={onSignOut}><LogOut size={15} /> Sair da conta</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{user.role === 'teacher' ? 'ESPAÇO DO PROFESSOR' : 'ESPAÇO DO ALUNO'}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page === 'overview' ? 'RESUMO' : page === 'calendar' ? 'CALENDÁRIO' : page === 'subjects' ? 'DISCIPLINAS' : 'AVALIAÇÕES'}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar avaliação..."
                aria-label="Buscar avaliações"
              />
              <kbd>⌘ K</kbd>
            </label>
            <div className="reminder-wrap">
              <button
                type="button"
                className={`icon-button notification-button ${showReminders ? 'is-open' : ''}`}
                onClick={() => setShowReminders((open) => !open)}
                aria-label="Abrir lembretes"
                aria-expanded={showReminders}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-dot" />}
              </button>
              {showReminders && (
                <div className="reminder-popover">
                  <div className="popover-heading">
                    <div><span className="eyebrow">NOTIFICAÇÕES</span><h2>Novidades da turma</h2></div>
                    <button type="button" className="quiet-icon" onClick={() => setShowReminders(false)} aria-label="Fechar lembretes"><X size={16} /></button>
                  </div>
                  {notifications.slice(0, 5).map((notification) => (
                    <button
                      type="button"
                      className={`reminder-item ${notification.read_at ? '' : 'unread'}`}
                      key={notification.id}
                      onClick={() => markNotificationRead(notification)}
                    >
                      <span className="reminder-marker tone-blue" />
                      <span className="reminder-copy"><strong>{notification.title}</strong><small>{notification.message}</small></span>
                    </button>
                  ))}
                  {notifications.length === 0 && <p className="empty-note">Você não tem notificações.</p>}
                </div>
              )}
            </div>
            <button type="button" className="mobile-avatar" onClick={onSignOut} aria-label={`Sair da conta de ${user.name}`} title="Sair da conta">{getInitials(user.name)}</button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('pt-BR')}</p>
              <h1>{titleByPage[page]}</h1>
              <p className="welcome-subtitle">{user.role === 'teacher' ? 'Suas turmas e avaliações, organizadas em um só lugar.' : 'Um passo de cada vez. Seu semestre está no ritmo.'}</p>
            </div>
            <button
              type="button"
              className="primary-button"
              aria-label={user.role === 'teacher' ? classrooms.length ? 'Nova avaliação' : 'Nova turma' : 'Entrar em turma'}
              onClick={openPrimaryAction}
            >
              {user.role === 'teacher' ? <Plus size={17} strokeWidth={2.4} /> : <DoorOpen size={17} />}
              <span>{user.role === 'teacher' ? classrooms.length ? 'Nova avaliação' : 'Nova turma' : 'Entrar em turma'}</span>
            </button>
          </section>

          {error && <div className="api-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Fechar mensagem"><X size={15} /></button></div>}

          <section className="stats-strip" aria-label="Resumo dos estudos">
            <StatCard
              label="PRÓXIMOS 30 DIAS"
              value={monthlyExams.length.toString().padStart(2, '0')}
              note="avaliações no calendário"
              icon={<CalendarDays size={17} />}
              accent="stat-coral"
            />
            <StatCard
              label={user.role === 'student' ? 'ETAPAS DE ESTUDO' : 'TURMAS ATIVAS'}
              value={(user.role === 'student' ? checklistStats.remaining : classrooms.length).toString().padStart(2, '0')}
              note={user.role === 'student' ? 'ainda para concluir' : 'sob sua responsabilidade'}
              icon={<ListChecks size={17} />}
              accent="stat-blue"
            />
            <StatCard
              label="DISCIPLINAS"
              value={subjects.length.toString().padStart(2, '0')}
              note="neste semestre"
              icon={<GraduationCap size={18} />}
              accent="stat-green"
            />
            <div className="focus-note">
              <span className="focus-spark"><Sparkles size={15} /></span>
              <div><strong>Próximo foco</strong><span>{upcomingExams[0] ? `${upcomingExams[0].subject} · ${upcomingExams[0].title}` : 'Organize seus estudos'}</span></div>
              <ArrowUpRight size={16} />
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="agenda-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SEU PLANEJAMENTO</p>
                  <h2>{page === 'calendar' ? 'Visão do mês' : page === 'subjects' ? 'Avaliações por disciplina' : 'Agenda de avaliações'}</h2>
                </div>
                {page !== 'calendar' && (
                  <div className="segmented-control" role="group" aria-label="Filtrar período">
                    {periodOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={period === option.id ? 'selected' : ''}
                        onClick={() => { setPeriod(option.id); setDateFilter('') }}
                      >{option.label}</button>
                    ))}
                  </div>
                )}
              </div>

              {page === 'subjects' && (
                <>
                  {user.role === 'teacher' && (
                    <div className="classroom-list" aria-label="Minhas turmas">
                      {classrooms.map((classroom) => (
                        <article className="classroom-card" key={classroom.id}>
                          <div><strong>{classroom.subject}</strong><span>{classroom.name}</span></div>
                          {classroom.join_code && <span className="classroom-code"><small>CÓDIGO</small><strong>{classroom.join_code}</strong></span>}
                        </article>
                      ))}
                      {classrooms.length === 0 && <p className="empty-note">Crie uma turma para compartilhar um código de acesso.</p>}
                    </div>
                  )}
                  <div className="subject-filter-row">
                    <button type="button" className={`subject-chip ${!subjectFilter ? 'active' : ''}`} onClick={() => setSubjectFilter('')}>Todas</button>
                    {subjects.map((subject) => (
                      <button type="button" key={subject} className={`subject-chip ${subjectFilter === subject ? 'active' : ''}`} onClick={() => setSubjectFilter(subject)}>{subject}</button>
                    ))}
                  </div>
                </>
              )}

              {page === 'calendar' ? (
                <CalendarView
                  month={calendarMonth}
                  exams={exams}
                  onNavigate={navigateMonth}
                  onSelectExam={setSelectedExamId}
                  onSelectDate={(date) => {
                    setPage('exams')
                    setPeriod('all')
                    setQuery('')
                    setSubjectFilter('')
                    setDateFilter(date)
                  }}
                />
              ) : (
                <div className="exam-list">
                  {isLoading && <div className="empty-state" role="status"><strong>Carregando seus dados...</strong></div>}
                  {!isLoading && filteredExams.map((exam) => (
                    <ExamRow key={exam.id} exam={exam} onClick={() => setSelectedExamId(exam.id)} />
                  ))}
                  {!isLoading && filteredExams.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon"><Search size={19} /></span>
                      <strong>{exams.length === 0 ? 'Sua agenda ainda está vazia' : 'Nenhuma avaliação encontrada'}</strong>
                      <p>{exams.length === 0
                        ? user.role === 'student' ? 'Entre em uma turma com o código compartilhado pelo professor.' : 'Crie uma turma e adicione a primeira avaliação.'
                        : 'Ajuste a busca ou escolha outro período.'}</p>
                      {exams.length === 0 && (
                        <button type="button" className="text-button" onClick={() => setShowClassroomModal(true)}>
                          {user.role === 'teacher' ? 'Criar turma' : 'Entrar em turma'} <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {dateFilter && page !== 'calendar' && (
                <div className="selected-date-filter">
                  <span>Data selecionada: <strong>{formatDate(dateFilter, { weekday: 'long', day: 'numeric', month: 'long' })}</strong></span>
                  <button type="button" className="quiet-icon" onClick={() => setDateFilter('')} aria-label="Limpar filtro de data"><X size={14} /></button>
                </div>
              )}

              <div className="agenda-footer">
                <span>Mostrando {page === 'calendar' ? exams.length : filteredExams.length} {page === 'calendar' ? 'avaliações no calendário' : `de ${exams.length} avaliações`}</span>
                <button type="button" className="text-button" onClick={() => { setPage('exams'); setPeriod('all') }}>
                  Ver tudo <ArrowUpRight size={14} />
                </button>
              </div>
            </section>

            <aside className="right-rail">
              <section className="progress-panel">
                <div className="rail-heading">
                  <div><p className="eyebrow">{user.role === 'student' ? 'CONSISTÊNCIA' : 'ORGANIZAÇÃO'}</p><h2>{user.role === 'student' ? 'Seu ritmo' : 'Suas turmas'}</h2></div>
                  <span className="round-icon"><Sparkles size={16} /></span>
                </div>
                {user.role === 'student' ? (
                  <>
                    <div className="progress-number">{completedPercent}<span>%</span></div>
                    <p className="progress-caption">das etapas de estudo já concluídas</p>
                    <div className="large-progress-track"><span style={{ width: `${completedPercent}%` }} /></div>
                    <div className="progress-meta"><span><CheckCircle2 size={14} /> {checklistStats.completed} concluídas</span><span>{checklistStats.remaining} pendentes</span></div>
                  </>
                ) : (
                  <>
                    <div className="progress-number">{classrooms.length.toString().padStart(2, '0')}</div>
                    <p className="progress-caption">turmas vinculadas ao seu perfil</p>
                    <div className="large-progress-track"><span style={{ width: classrooms.length ? '100%' : '0%' }} /></div>
                    <div className="progress-meta"><span>{exams.length} avaliações ativas</span><span>{monthlyExams.length} nos próximos 30 dias</span></div>
                  </>
                )}
              </section>

              <section className="next-panel">
                <div className="rail-heading">
                  <div><p className="eyebrow">NÃO DEIXE PASSAR</p><h2>Próximas datas</h2></div>
                  <Clock3 size={17} className="muted-icon" />
                </div>
                <div className="next-list">
                  {upcomingExams.slice(0, 4).map((exam) => (
                    <button type="button" className="next-item" key={exam.id} onClick={() => setSelectedExamId(exam.id)}>
                      <span className={`next-date ${getToneClass(exam.tone)}`}>
                        <strong>{formatDate(exam.date, { day: '2-digit' })}</strong>
                        <small>{formatDate(exam.date, { month: 'short' }).replace('.', '')}</small>
                      </span>
                      <span className="next-copy"><strong>{exam.subject}</strong><small>{exam.title}</small></span>
                      <ChevronRight size={15} className="next-chevron" />
                    </button>
                  ))}
                  {upcomingExams.length === 0 && <p className="empty-note">Seu calendário está livre por enquanto.</p>}
                </div>
                <button type="button" className="calendar-link" onClick={() => changePage('calendar')}>
                  <CalendarDays size={15} /> Abrir calendário <ArrowUpRight size={14} />
                </button>
              </section>

              <section className="study-tip">
                <span className="tip-mark">“</span>
                <p>Aprender também é saber quando fazer uma pausa.</p>
                <span className="tip-credit">LEMBRETE DO CADERNO</span>
              </section>
            </aside>
          </div>

          <footer className="page-footer">
            <span>CADERNO ACADÊMICO</span>
            <span className="footer-divider" />
            <span>Seu espaço de estudos, no seu ritmo.</span>
          </footer>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        <MobileNavButton active={page === 'overview'} icon={<LayoutDashboard size={19} />} label="Início" onClick={() => changePage('overview')} />
        <MobileNavButton active={page === 'exams'} icon={<ListChecks size={19} />} label="Provas" onClick={() => changePage('exams')} />
        <MobileNavButton active={page === 'calendar'} icon={<CalendarDays size={19} />} label="Calendário" onClick={() => changePage('calendar')} />
        <MobileNavButton active={page === 'subjects'} icon={<GraduationCap size={19} />} label="Matérias" onClick={() => changePage('subjects')} />
      </nav>

      {selectedExam && (
        <ExamDialog
          exam={selectedExam}
          role={user.role}
          error={error}
          isSaving={isSaving}
          onClose={() => setSelectedExamId(null)}
          onEdit={() => {
            setEditingExam(selectedExam)
            setSelectedExamId(null)
            setShowAddModal(true)
          }}
          onToggleItem={toggleChecklistItem}
          onAddItem={(title) => addChecklistItem(selectedExam, title)}
          onRemoveItem={removeChecklistItem}
          onCancel={() => cancelExam(selectedExam.id)}
        />
      )}
      {showAddModal && user.role === 'teacher' && (
        <AddExamDialog
          classrooms={classrooms}
          initialExam={editingExam}
          error={error}
          isSaving={isSaving}
          onClose={() => { setShowAddModal(false); setEditingExam(null) }}
          onSave={saveExam}
        />
      )}
      {showClassroomModal && (
        <ClassroomDialog
          role={user.role}
          error={error}
          isSaving={isSaving}
          onClose={() => setShowClassroomModal(false)}
          onSave={saveClassroom}
        />
      )}
    </div>
  )
}

function NavItem({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-icon">{icon}</span><span>{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  )
}

function MobileNavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" className={`mobile-nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function StatCard({ label, value, note, icon, accent }: { label: string; value: string; note: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className={`stat-card ${accent}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-copy"><span className="eyebrow">{label}</span><div className="stat-bottom"><strong>{value}</strong><span>{note}</span></div></div>
      <ArrowUpRight size={15} className="stat-arrow" />
    </div>
  )
}

function ExamRow({ exam, onClick }: { exam: StudyExam; onClick: () => void }) {
  const completed = exam.checklist.filter((item) => item.completed).length
  const total = exam.checklist.length
  const distance = daysUntil(exam.date)
  return (
    <article className={`exam-row ${getToneClass(exam.tone)}`}>
      <button type="button" className="exam-row-main" onClick={onClick}>
        <span className="exam-date-block"><strong>{formatDate(exam.date, { day: '2-digit' })}</strong><small>{formatDate(exam.date, { month: 'short' }).replace('.', '')}</small></span>
        <span className="exam-color-mark" />
        <span className="exam-info">
          <span className="exam-subject">{exam.subject}</span>
          <strong className="exam-title">{exam.title}</strong>
          <span className="exam-meta"><span><Clock3 size={13} /> {exam.time}</span><span><MapPin size={13} /> {exam.room}</span></span>
        </span>
        {total > 0 && <span className="exam-progress"><span>{completed}/{total}</span><span className="mini-progress"><i style={{ width: `${total ? (completed / total) * 100 : 0}%` }} /></span><small>etapas</small></span>}
        <span className={`exam-countdown ${distance <= 2 ? 'urgent' : ''}`}>{relativeDate(exam.date)}</span>
        <ChevronRight size={16} className="exam-chevron" />
      </button>
    </article>
  )
}

function CalendarView({
  month,
  exams,
  onNavigate,
  onSelectExam,
  onSelectDate,
}: {
  month: Date
  exams: StudyExam[]
  onNavigate: (offset: number) => void
  onSelectExam: (id: string) => void
  onSelectDate: (date: string) => void
}) {
  const days = makeCalendarDays(month)
  const today = todayString()
  return (
    <div className="calendar-view">
      <div className="calendar-toolbar">
        <h3>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <div className="calendar-controls">
          <button type="button" className="quiet-icon" onClick={() => onNavigate(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
          <button type="button" className="today-button" onClick={() => onSelectDate(today)}>Hoje</button>
          <button type="button" className="quiet-icon" onClick={() => onNavigate(1)} aria-label="Próximo mês"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="calendar-grid" role="grid" aria-label="Calendário mensal">
        {weekdayLabels.map((weekday) => <span className="calendar-weekday" key={weekday}>{weekday}</span>)}
        {days.map((date) => {
          const dateKey = localDateString(date)
          const dayExams = exams.filter((exam) => exam.date === dateKey)
          const isCurrentMonth = date.getMonth() === month.getMonth()
          return (
            <div className={`calendar-day ${!isCurrentMonth ? 'outside-month' : ''} ${dateKey === today ? 'is-today' : ''}`} key={dateKey}>
              <button type="button" className="calendar-day-number" onClick={() => onSelectDate(dateKey)} aria-label={`Abrir ${date.toLocaleDateString('pt-BR')}`}>
                <span>{date.getDate()}</span>
                {dateKey === today && <i />}
              </button>
              <div className="calendar-events">
                {dayExams.slice(0, 2).map((exam) => (
                  <button type="button" key={exam.id} className={`calendar-event ${getToneClass(exam.tone)}`} onClick={() => onSelectExam(exam.id)} title={exam.title}>
                    <span />{exam.subject}
                  </button>
                ))}
                {dayExams.length > 2 && <span className="calendar-more">+{dayExams.length - 2} mais</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="calendar-legend"><span><i className="legend-coral" /> Avaliação</span><span><i className="legend-blue" /> Entrega</span><span><i className="legend-green" /> Prova</span></div>
    </div>
  )
}

function ExamDialog({
  exam,
  role,
  error,
  isSaving,
  onClose,
  onEdit,
  onToggleItem,
  onAddItem,
  onRemoveItem,
  onCancel,
}: {
  exam: StudyExam
  role: UserRole
  error: string
  isSaving: boolean
  onClose: () => void
  onEdit: () => void
  onToggleItem: (itemId: string) => void
  onAddItem: (title: string) => void
  onRemoveItem: (itemId: string) => void
  onCancel: () => void
}) {
  const [newTask, setNewTask] = useState('')
  const completed = exam.checklist.filter((item) => item.completed).length
  const distance = daysUntil(exam.date)

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTask.trim()
    if (!title) return
    onAddItem(title)
    setNewTask('')
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog exam-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title">
        <div className={`dialog-accent ${getToneClass(exam.tone)}`} />
        <header className="dialog-header">
          <div><span className="eyebrow">{exam.subject}</span><span className={`dialog-date-pill ${getToneClass(exam.tone)}`}>{relativeDate(exam.date)}</span></div>
          <button type="button" className="quiet-icon" onClick={onClose} aria-label="Fechar detalhes"><X size={19} /></button>
        </header>
        <div className="dialog-body">
          <h2 id="exam-dialog-title">{exam.title}</h2>
          <p className="dialog-intro">{exam.content || 'Sem conteúdo adicional cadastrado para esta avaliação.'}</p>
          <div className="detail-facts">
            <div className="detail-fact"><span className="fact-icon"><CalendarDays size={16} /></span><div><small>DATA E HORÁRIO</small><strong>{formatDate(exam.date, { weekday: 'long', day: 'numeric', month: 'long' })}, {exam.time}</strong></div></div>
            <div className="detail-fact"><span className="fact-icon"><MapPin size={16} /></span><div><small>LOCAL</small><strong>{exam.room || 'A definir'}</strong></div></div>
            <div className="detail-fact"><span className="fact-icon"><GraduationCap size={16} /></span><div><small>DOCENTE</small><strong>{exam.teacher || 'Não informado'}</strong></div></div>
            <div className="detail-fact"><span className="fact-icon"><Sparkles size={16} /></span><div><small>PESO</small><strong>{exam.weight}</strong></div></div>
          </div>

          {role === 'student' && (
            <>
              <div className="dialog-section-heading"><div><span className="eyebrow">PLANO DE REVISÃO</span><h3>Etapas de estudo</h3></div><span className="task-counter">{completed}/{exam.checklist.length}</span></div>
              <div className="checklist-items">
                {exam.checklist.map((item) => (
                  <div className={`checklist-item ${item.completed ? 'completed' : ''}`} key={item.id}>
                    <button type="button" className="check-toggle" onClick={() => onToggleItem(item.id)} disabled={isSaving} aria-label={item.completed ? `Reabrir ${item.title}` : `Concluir ${item.title}`}>
                      {item.completed ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                    </button>
                    <span>{item.title}</span>
                    <button type="button" className="quiet-icon remove-task" onClick={() => onRemoveItem(item.id)} disabled={isSaving} aria-label={`Remover ${item.title}`}><Trash2 size={15} /></button>
                  </div>
                ))}
                {exam.checklist.length === 0 && <p className="empty-note">Adicione uma etapa para dividir sua revisão.</p>}
              </div>
              <form className="add-checklist-form" onSubmit={submitTask}>
                <input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Adicionar etapa de estudo..." aria-label="Nova etapa de estudo" maxLength={180} />
                <button type="submit" aria-label="Adicionar etapa" disabled={!newTask.trim() || isSaving}><Plus size={17} /></button>
              </form>
            </>
          )}

          {error && <p className="api-alert dialog-alert" role="alert">{error}</p>}

          {exam.materials.length > 0 && (
            <div className="materials-section">
              <div className="dialog-section-heading"><div><span className="eyebrow">MATERIAIS</span><h3>Para consultar</h3></div></div>
              {exam.materials.map((material) => (
                <a className="material-link" href={material.url} target="_blank" rel="noreferrer" key={`${material.title}-${material.url}`}>
                  <span className="material-icon"><BookOpenCheck size={15} /></span><span>{material.title}</span><ExternalLink size={14} />
                </a>
              ))}
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          {role === 'teacher' && (
            <div className="exam-management-actions">
              <button type="button" className="secondary-button" onClick={onEdit} disabled={isSaving}>Editar avaliação</button>
              <button type="button" className="delete-button" onClick={onCancel} disabled={isSaving}><X size={15} /> Cancelar avaliação</button>
            </div>
          )}
          <span>{distance < 0 ? 'Data encerrada' : `${Math.max(0, distance)} ${distance === 1 ? 'dia' : 'dias'} para a avaliação`}</span>
        </footer>
      </section>
    </div>
  )
}

function AddExamDialog({
  classrooms,
  initialExam,
  error,
  isSaving,
  onClose,
  onSave,
}: {
  classrooms: Classroom[]
  initialExam: StudyExam | null
  error: string
  isSaving: boolean
  onClose: () => void
  onSave: (exam: { classroomId: string; title: string; startsAt: string; weight: number; content: string; materials: Array<{ title: string; url: string }> }, examId?: string) => void
}) {
  const [title, setTitle] = useState(initialExam?.title ?? '')
  const [classroomId, setClassroomId] = useState(initialExam?.classroomId ?? classrooms[0]?.id ?? '')
  const [date, setDate] = useState(initialExam?.date ?? todayString())
  const [time, setTime] = useState(initialExam?.time ?? '09:00')
  const [weight, setWeight] = useState(String(initialExam?.weight ?? 1))
  const [content, setContent] = useState(initialExam?.content ?? '')
  const [materials, setMaterials] = useState<StudyMaterial[]>(initialExam?.materials ?? [])

  function submitExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!classroomId) return
    const startsAt = new Date(`${date}T${time}`)
    onSave({
      classroomId,
      title: title.trim(),
      startsAt: startsAt.toISOString(),
      weight: Number(weight),
      content: content.trim(),
      materials: materials.filter((material) => material.title.trim() && material.url.trim()),
    }, initialExam?.id)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
        <header className="dialog-header add-dialog-header">
          <div><span className="eyebrow">{initialExam ? 'ATUALIZE SUA TURMA' : 'ORGANIZE SUA TURMA'}</span><h2 id="add-dialog-title">{initialExam ? 'Editar avaliação' : 'Nova avaliação'}</h2></div>
          <button type="button" className="quiet-icon" onClick={onClose} aria-label="Fechar formulário"><X size={19} /></button>
        </header>
        <form className="add-exam-form" onSubmit={submitExam}>
          <label className="form-field full-field"><span>Nome da avaliação</span><input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Prova 1 · Álgebra Linear" maxLength={160} /></label>
          <label className="form-field full-field"><span>Turma</span><select required value={classroomId} disabled={Boolean(initialExam)} onChange={(event) => setClassroomId(event.target.value)}><option value="" disabled>Selecione uma turma</option>{classrooms.map((classroom) => <option value={classroom.id} key={classroom.id}>{classroom.subject} · {classroom.name}</option>)}</select></label>
          <label className="form-field"><span>Data</span><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="form-field"><span>Horário</span><input required type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <label className="form-field"><span>Peso</span><input required type="number" min="0.01" max="999.99" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
          <label className="form-field full-field"><span>Conteúdo e observações</span><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Tópicos que serão cobrados, instruções..." rows={3} maxLength={1000} /></label>
          <div className="materials-editor full-field">
            <div className="materials-editor-heading"><span>Materiais de apoio</span><button type="button" className="text-button" onClick={() => setMaterials((current) => [...current, { title: '', url: '' }])} disabled={materials.length >= 20}>Adicionar link <Plus size={13} /></button></div>
            {materials.map((material, index) => (
              <div className="material-fields" key={`material-${index}`}>
                <label className="form-field"><span>Nome</span><input required={Boolean(material.title || material.url)} value={material.title} onChange={(event) => setMaterials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder="Nome do material" maxLength={120} /></label>
                <label className="form-field"><span>Link</span><input required={Boolean(material.title || material.url)} type="url" value={material.url} onChange={(event) => setMaterials((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} placeholder="https://..." maxLength={2048} /></label>
                <button type="button" className="quiet-icon" onClick={() => setMaterials((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover material ${index + 1}`}><X size={15} /></button>
              </div>
            ))}
          </div>
          {error && <p className="api-alert dialog-alert full-field" role="alert">{error}</p>}
          {!classrooms.length && <p className="empty-note full-field">Crie uma turma antes de cadastrar uma avaliação.</p>}
          <div className="form-actions full-field"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={!classroomId || isSaving}><Plus size={16} /> {isSaving ? 'Salvando...' : initialExam ? 'Salvar alterações' : 'Adicionar à agenda'}</button></div>
        </form>
      </section>
    </div>
  )
}

function ClassroomDialog({
  role,
  error,
  isSaving,
  onClose,
  onSave,
}: {
  role: UserRole
  error: string
  isSaving: boolean
  onClose: () => void
  onSave: (payload: { name: string; subject: string } | { code: string }) => void
}) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [code, setCode] = useState('')
  const isTeacher = role === 'teacher'

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(isTeacher
      ? { name: name.trim(), subject: subject.trim() }
      : { code: code.trim().toUpperCase() })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="classroom-dialog-title">
        <header className="dialog-header add-dialog-header">
          <div><span className="eyebrow">{isTeacher ? 'ESPAÇO DO PROFESSOR' : 'ESPAÇO DO ALUNO'}</span><h2 id="classroom-dialog-title">{isTeacher ? 'Criar turma' : 'Entrar em uma turma'}</h2></div>
          <button type="button" className="quiet-icon" onClick={onClose} aria-label="Fechar formulário"><X size={19} /></button>
        </header>
        <form className="add-exam-form classroom-form" onSubmit={submit}>
          {isTeacher ? (
            <>
              <label className="form-field full-field"><span>Nome da turma</span><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Engenharia · 2026.2" maxLength={120} /></label>
              <label className="form-field full-field"><span>Disciplina</span><input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Ex.: Cálculo III" maxLength={120} /></label>
              <p className="classroom-hint full-field">Um código de acesso será criado para você compartilhar com seus alunos.</p>
            </>
          ) : (
            <label className="form-field full-field"><span>Código de acesso</span><input required autoFocus value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Ex.: A1B2C3D4" minLength={4} maxLength={12} autoCapitalize="characters" /></label>
          )}
          {error && <p className="api-alert dialog-alert full-field" role="alert">{error}</p>}
          <div className="form-actions full-field"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Salvando...' : isTeacher ? 'Criar turma' : 'Entrar na turma'}</button></div>
        </form>
      </section>
    </div>
  )
}

export default StudentDashboard