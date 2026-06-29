import { marked } from 'marked'
import type { TutorialControls } from '../hooks/useTutorial.js'
import type { FitnessRule } from '../types.js'

interface TutorialPanelProps {
  tutorialTitle: string
  controls: TutorialControls
  onExit: () => void
}

function fitnessLabel(rule: FitnessRule): string {
  switch (rule.type) {
    case 'play': return 'Press Play'
    case 'code_contains': return `Code contains "${rule.value}"`
    case 'code_matches': return `Code matches /${rule.pattern}/`
    case 'quiz': return 'Answer the question'
  }
}

export function TutorialPanel({ tutorialTitle, controls, onExit }: TutorialPanelProps) {
  const { steps, currentIndex, currentStep, fitness, allPassed, quizAnswers, goNext, goPrev, onQuizAnswer } = controls

  if (!currentStep) return null

  const contentHtml = String(marked.parse(currentStep.content))

  return (
    <div style={{
      width: 320,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tutorialTitle}
        </span>
        <button
          onClick={onExit}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}
        >
          Exit
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Progress */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          STEP {currentIndex + 1} OF {steps.length}
        </div>

        {/* Step title */}
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentStep.title}
        </div>

        {/* Markdown content */}
        <div
          // eslint-disable-next-line react/no-danger -- tutorial content is author-controlled, not user-generated
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}
        />

        {/* Quiz UI */}
        {currentStep.fitness.map((rule, ruleIndex) => {
          if (rule.type !== 'quiz') return null
          return (
            <div key={ruleIndex} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{rule.question}</div>
              {rule.options.map((opt, i) => {
                const selected = quizAnswers[ruleIndex] === i
                return (
                  <button
                    key={i}
                    onClick={() => onQuizAnswer(ruleIndex, i)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 10px',
                      background: selected ? 'var(--accent)' : 'var(--bg-overlay)',
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                      color: selected ? '#fff' : 'var(--text-primary)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          )
        })}

        {/* Fitness checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {currentStep.fitness.map((rule, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: fitness[i] ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600, width: 14, flexShrink: 0 }}>
                {fitness[i] ? '✓' : '○'}
              </span>
              <span style={{ color: fitness[i] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {fitnessLabel(rule)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
            padding: '5px 12px',
            borderRadius: 4,
            cursor: currentIndex === 0 ? 'default' : 'pointer',
            fontSize: 13,
          }}
        >
          ← Prev
        </button>
        <button
          onClick={goNext}
          disabled={!allPassed || currentIndex === steps.length - 1}
          style={{
            background: allPassed && currentIndex < steps.length - 1 ? 'var(--accent)' : 'var(--bg-overlay)',
            border: `1px solid ${allPassed && currentIndex < steps.length - 1 ? 'var(--accent)' : 'var(--border)'}`,
            color: allPassed && currentIndex < steps.length - 1 ? '#fff' : 'var(--text-muted)',
            padding: '5px 12px',
            borderRadius: 4,
            cursor: allPassed && currentIndex < steps.length - 1 ? 'pointer' : 'default',
            fontSize: 13,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
