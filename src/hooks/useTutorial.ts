import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import type { TutorialStep, FitnessRule } from '../types.js'

export interface TutorialControls {
  steps: TutorialStep[]
  currentIndex: number
  currentStep: TutorialStep | null
  fitness: boolean[]
  allPassed: boolean
  quizAnswers: (number | null)[]
  goNext: () => void
  goPrev: () => void
  onQuizAnswer: (ruleIndex: number, answer: number) => void
}

export function useTutorial(
  tutorialId: string | null,
  editorCode: string,
  isPlaying: boolean,
): TutorialControls {
  const [steps, setSteps] = useState<TutorialStep[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([])

  useEffect(() => {
    if (!tutorialId) {
      setSteps([])
      setCurrentIndex(0)
      setQuizAnswers([])
      return
    }
    let cancelled = false
    api.tutorials.steps(tutorialId).then((s) => {
      if (cancelled) return
      setSteps(s)
      setCurrentIndex(0)
    }).catch(() => {
      if (!cancelled) setSteps([])
    })
    return () => { cancelled = true }
  }, [tutorialId])

  useEffect(() => {
    const step = steps[currentIndex]
    setQuizAnswers(new Array(step?.fitness.length ?? 0).fill(null))
  }, [currentIndex, steps])

  const currentStep = steps[currentIndex] ?? null

  function evalRule(rule: FitnessRule, ruleIndex: number): boolean {
    switch (rule.type) {
      case 'play': return isPlaying
      case 'code_contains': return editorCode.includes(rule.value)
      case 'code_matches': {
        try { return new RegExp(rule.pattern).test(editorCode) } catch { return false }
      }
      case 'quiz': return quizAnswers[ruleIndex] === rule.answer
    }
  }

  const fitness = currentStep?.fitness.map((r, i) => evalRule(r, i)) ?? []
  const allPassed = fitness.length > 0 && fitness.every(Boolean)

  function goNext() {
    const next = currentIndex + 1
    if (next < steps.length) setCurrentIndex(next)
  }

  function goPrev() {
    const prev = currentIndex - 1
    if (prev >= 0) setCurrentIndex(prev)
  }

  function onQuizAnswer(ruleIndex: number, answer: number) {
    setQuizAnswers((prev) => {
      const next = [...prev]
      next[ruleIndex] = answer
      return next
    })
  }

  return {
    steps,
    currentIndex,
    currentStep,
    fitness,
    allPassed,
    quizAnswers,
    goNext,
    goPrev,
    onQuizAnswer,
  }
}
