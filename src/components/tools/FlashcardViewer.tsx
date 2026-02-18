import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { groqAPI } from '@/lib/groq';
import { FormattedMessage } from '@/components/ui/FormattedMessage';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit,
  FlipHorizontal,
  Lightbulb,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  Shuffle,
  Sparkles,
  Star,
  Timer,
  Trophy,
  Volume2,
  X,
  Zap,
} from 'lucide-react';

// Types (shared with FlashcardCreator)
export interface FlashcardData {
  id: string;
  term: string;
  definition: string;
}

export interface FlashcardDeckData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  cards: FlashcardData[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type StudyMode = 'default' | 'learn' | 'match' | 'spaced-repetition' | 'ai-chat';

// Study mode option card
interface StudyModeCardProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  badge?: string;
}

function StudyModeCard({ icon, label, onClick, badge }: StudyModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/50 border border-border/50 rounded-xl transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
            {badge}
          </span>
        )}
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}

// ─── Utility: Fisher-Yates shuffle ──────────────────────────────────────────
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Learn Mode ─────────────────────────────────────────────────────────────
interface LearnModeProps {
  cards: FlashcardData[];
  onExit: () => void;
}

function LearnMode({ cards, onExit }: LearnModeProps) {
  const [questionIdx, setQuestionIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [finished, setFinished] = useState(false);

  // Generate multiple-choice options for a question
  const getOptions = useCallback(
    (correctIdx: number) => {
      const correct = cards[correctIdx];
      const distractors = cards
        .filter((_, i) => i !== correctIdx)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return fisherYatesShuffle([correct, ...distractors]);
    },
    [cards]
  );

  const [options, setOptions] = useState<FlashcardData[]>(() => getOptions(0));

  const handleAnswer = useCallback(
    (answerId: string) => {
      if (selectedAnswer) return; // already answered
      setSelectedAnswer(answerId);
      const correct = answerId === cards[questionIdx].id;
      setIsCorrect(correct);
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        incorrect: s.incorrect + (correct ? 0 : 1),
      }));
    },
    [selectedAnswer, cards, questionIdx]
  );

  const nextQuestion = useCallback(() => {
    const nextIdx = questionIdx + 1;
    if (nextIdx >= cards.length) {
      setFinished(true);
      return;
    }
    setQuestionIdx(nextIdx);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setOptions(getOptions(nextIdx));
  }, [questionIdx, cards.length, getOptions]);

  if (finished) {
    const pct = Math.round((score.correct / cards.length) * 100);
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
        <Trophy className={cn("h-16 w-16", pct >= 70 ? "text-yellow-400" : "text-muted-foreground")} />
        <h2 className="text-2xl font-bold">Learn Complete!</h2>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-green-500">{score.correct}</p>
            <p className="text-sm text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-500">{score.incorrect}</p>
            <p className="text-sm text-muted-foreground">Incorrect</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary">{pct}%</p>
            <p className="text-sm text-muted-foreground">Score</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setQuestionIdx(0);
              setSelectedAnswer(null);
              setIsCorrect(null);
              setScore({ correct: 0, incorrect: 0 });
              setFinished(false);
              setOptions(getOptions(0));
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={onExit}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <span className="text-sm font-medium">
          {questionIdx + 1} / {cards.length}
        </span>
        <div className="flex gap-3 text-sm">
          <span className="text-green-500">{score.correct} ✓</span>
          <span className="text-red-500">{score.incorrect} ✗</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full mb-8">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${((questionIdx + 1) / cards.length) * 100}%` }}
        />
      </div>
      {/* Question */}
      <div className="flex-1 flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-2">What is the definition of:</p>
        <h2 className="text-2xl font-bold text-center mb-8">{cards[questionIdx]?.term}</h2>
        {/* Options */}
        <div className="w-full max-w-xl space-y-3">
          {options.map((opt) => {
            const isSelected = selectedAnswer === opt.id;
            const isAnswer = opt.id === cards[questionIdx].id;
            let borderClass = 'border-border/50 hover:border-primary/40';
            if (selectedAnswer) {
              if (isAnswer) borderClass = 'border-green-500 bg-green-500/10';
              else if (isSelected && !isAnswer) borderClass = 'border-red-500 bg-red-500/10';
            }
            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={!!selectedAnswer}
                className={cn(
                  'w-full text-left px-5 py-4 rounded-xl border transition-colors',
                  borderClass,
                  !selectedAnswer && 'cursor-pointer'
                )}
              >
                <p className="text-sm">{opt.definition}</p>
              </button>
            );
          })}
        </div>
        {selectedAnswer && (
          <Button className="mt-6" onClick={nextQuestion}>
            {questionIdx + 1 >= cards.length ? 'See Results' : 'Next Question'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Match Mode ─────────────────────────────────────────────────────────────
interface MatchModeProps {
  cards: FlashcardData[];
  onExit: () => void;
}

function MatchMode({ cards: allCards, onExit }: MatchModeProps) {
  const cards = useMemo(() => allCards.slice(0, 6), [allCards]); // limit to 6 pairs
  const [selected, setSelected] = useState<{ type: 'term' | 'def'; id: string } | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [endTime, setEndTime] = useState<number | null>(null);

  const shuffledTerms = useMemo(() => fisherYatesShuffle(cards), [cards]);
  const shuffledDefs = useMemo(() => fisherYatesShuffle(cards), [cards]);

  const handleSelect = useCallback(
    (type: 'term' | 'def', id: string) => {
      if (matched.has(id)) return;
      if (!selected) {
        setSelected({ type, id });
        return;
      }
      if (selected.type === type) {
        setSelected({ type, id });
        return;
      }
      // Check match
      if (selected.id === id) {
        const newMatched = new Set(matched);
        newMatched.add(id);
        setMatched(newMatched);
        setSelected(null);
        if (newMatched.size === cards.length) {
          setEndTime(Date.now());
        }
      } else {
        setWrongPair(id);
        setTimeout(() => {
          setWrongPair(null);
          setSelected(null);
        }, 600);
      }
    },
    [selected, matched, cards.length]
  );

  if (endTime) {
    const seconds = Math.round((endTime - startTime) / 1000);
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold">All Matched!</h2>
        <p className="text-lg text-muted-foreground">
          Completed in <span className="font-bold text-foreground">{seconds}s</span>
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setMatched(new Set());
              setSelected(null);
              setEndTime(null);
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Play Again
          </Button>
          <Button onClick={onExit}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-lg font-bold">Match</h2>
        <span className="text-sm text-muted-foreground">
          {matched.size}/{cards.length} matched
        </span>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-6 max-w-3xl mx-auto w-full">
        {/* Terms column */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Terms</p>
          {shuffledTerms.map((card) => {
            const isMatched = matched.has(card.id);
            const isSelected = selected?.type === 'term' && selected.id === card.id;
            const isWrong = wrongPair === card.id && selected?.type === 'def';
            return (
              <button
                key={`t-${card.id}`}
                onClick={() => handleSelect('term', card.id)}
                disabled={isMatched}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm',
                  isMatched && 'opacity-30 cursor-default border-green-500/50',
                  isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                  isWrong && 'border-red-500 bg-red-500/10 animate-shake',
                  !isMatched && !isSelected && !isWrong && 'border-border/50 hover:border-primary/40 cursor-pointer'
                )}
              >
                {card.term}
              </button>
            );
          })}
        </div>
        {/* Definitions column */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Definitions</p>
          {shuffledDefs.map((card) => {
            const isMatched = matched.has(card.id);
            const isSelected = selected?.type === 'def' && selected.id === card.id;
            const isWrong = wrongPair === card.id && selected?.type === 'term';
            return (
              <button
                key={`d-${card.id}`}
                onClick={() => handleSelect('def', card.id)}
                disabled={isMatched}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border transition-all text-sm',
                  isMatched && 'opacity-30 cursor-default border-green-500/50',
                  isSelected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                  isWrong && 'border-red-500 bg-red-500/10',
                  !isMatched && !isSelected && !isWrong && 'border-border/50 hover:border-primary/40 cursor-pointer'
                )}
              >
                {card.definition}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Spaced Repetition Mode ─────────────────────────────────────────────────
interface SpacedRepetitionProps {
  cards: FlashcardData[];
  onExit: () => void;
}

type SRDifficulty = 'again' | 'hard' | 'good' | 'easy';

function SpacedRepetitionMode({ cards, onExit }: SpacedRepetitionProps) {
  const [queue, setQueue] = useState<FlashcardData[]>(() => fisherYatesShuffle(cards));
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ratings, setRatings] = useState<Record<string, SRDifficulty>>({});

  const currentCard = queue[0];
  const finished = queue.length === 0;

  const handleRate = useCallback(
    (difficulty: SRDifficulty) => {
      if (!currentCard) return;
      setRatings((r) => ({ ...r, [currentCard.id]: difficulty }));
      setReviewed((r) => r + 1);

      // If 'again', push to back of queue; otherwise remove
      if (difficulty === 'again') {
        setQueue((q) => [...q.slice(1), q[0]]);
      } else {
        setQueue((q) => q.slice(1));
      }
      setIsFlipped(false);
    },
    [currentCard]
  );

  if (finished) {
    const counts = { again: 0, hard: 0, good: 0, easy: 0 };
    Object.values(ratings).forEach((r) => counts[r]++);
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
        <Brain className="h-16 w-16 text-purple-400" />
        <h2 className="text-2xl font-bold">Session Complete!</h2>
        <p className="text-muted-foreground">You reviewed {reviewed} cards</p>
        <div className="flex gap-4 text-center text-sm">
          <div>
            <p className="text-2xl font-bold text-red-500">{counts.again}</p>
            <p className="text-muted-foreground">Again</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{counts.hard}</p>
            <p className="text-muted-foreground">Hard</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{counts.good}</p>
            <p className="text-muted-foreground">Good</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-500">{counts.easy}</p>
            <p className="text-muted-foreground">Easy</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setQueue(fisherYatesShuffle(cards));
              setIsFlipped(false);
              setReviewed(0);
              setRatings({});
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Study Again
          </Button>
          <Button onClick={onExit}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-lg font-bold">Spaced Repetition</h2>
        <span className="text-sm text-muted-foreground">{queue.length} remaining</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full mb-6">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(reviewed / (reviewed + queue.length)) * 100}%` }}
        />
      </div>
      <div
        className="flex-1 min-h-[280px] cursor-pointer perspective-1000"
        onClick={() => setIsFlipped((f) => !f)}
      >
        <div
          className={cn(
            'relative w-full h-full transition-transform duration-500 transform-style-3d',
            isFlipped && 'rotate-y-180'
          )}
        >
          <div className="absolute inset-0 backface-hidden rounded-2xl bg-card border border-border/50 flex items-center justify-center p-8">
            <p className="text-2xl font-medium text-center select-none">{currentCard?.term}</p>
          </div>
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-card border border-border/50 flex items-center justify-center p-8">
            <p className="text-xl text-center select-none">{currentCard?.definition}</p>
          </div>
        </div>
      </div>
      {!isFlipped ? (
        <p className="text-center text-sm text-muted-foreground mt-4">Click to reveal answer</p>
      ) : (
        <div className="flex justify-center gap-3 mt-6">
          <Button variant="outline" className="border-red-500/50 text-red-500 hover:bg-red-500/10" onClick={() => handleRate('again')}>
            Again
          </Button>
          <Button variant="outline" className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10" onClick={() => handleRate('hard')}>
            Hard
          </Button>
          <Button variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/10" onClick={() => handleRate('good')}>
            Good
          </Button>
          <Button variant="outline" className="border-blue-500/50 text-blue-500 hover:bg-blue-500/10" onClick={() => handleRate('easy')}>
            Easy
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── AI Chat Mode ───────────────────────────────────────────────────────────
interface AIChatModeProps {
  deck: FlashcardDeckData;
  onExit: () => void;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

function AIChatMode({ deck, onExit }: AIChatModeProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your AI study buddy for "${deck.title}". Ask me anything about these flashcards — I can quiz you, explain concepts, give examples, or help you remember tricky terms. What would you like to work on?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMsg = { role: 'user', content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    const cardContext = deck.cards
      .map((c, i) => `${i + 1}. Term: "${c.term}" → Definition: "${c.definition}"`)
      .join('\n');

    try {
      const response = await groqAPI.chat({
        messages: [
          {
            role: 'system',
            content: `You are a friendly, expert study assistant. The student is studying a flashcard deck titled "${deck.title}". Here are all the flashcards:\n\n${cardContext}\n\nHelp the student learn these concepts. You can quiz them, provide explanations, mnemonics, examples, and encouragement. Keep responses concise and educational. Use formatting like bullet points when helpful.`,
          },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: userMsg.content },
        ],
        maxTokens: 800,
        temperature: 0.7,
      });
      setMessages((m) => [...m, { role: 'assistant', content: response.content }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Sorry, I ran into an error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, deck, messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          AI Chat
        </h2>
        <div className="w-16" />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%]',
              msg.role === 'user'
                ? 'ml-auto'
                : ''
            )}
          >
            {msg.role === 'user' ? (
              <div className="px-4 py-3 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-sm whitespace-pre-wrap">
                {msg.content}
              </div>
            ) : (
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted text-sm">
                <FormattedMessage content={msg.content} animated={true} animationSpeed={4} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking...
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about these flashcards..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {['Quiz me on these terms', 'Explain the hardest concept', 'Give me mnemonics'].map(
            (q) => (
              <button
                key={q}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
                onClick={() => {
                  setInput(q);
                }}
              >
                {q}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Panel ─────────────────────────────────────────────────────────
interface SettingsPanelProps {
  showTermFirst: boolean;
  setShowTermFirst: (v: boolean) => void;
  onlyStarred: boolean;
  setOnlyStarred: (v: boolean) => void;
  onClose: () => void;
}

function SettingsPanel({ showTermFirst, setShowTermFirst, onlyStarred, setOnlyStarred, onClose }: SettingsPanelProps) {
  return (
    <div className="absolute bottom-16 right-0 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Settings</h4>
        <button onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Show term first</span>
        <button
          onClick={() => setShowTermFirst(!showTermFirst)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            showTermFirst ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
              showTermFirst && 'translate-x-5'
            )}
          />
        </button>
      </label>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Only starred</span>
        <button
          onClick={() => setOnlyStarred(!onlyStarred)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            onlyStarred ? 'bg-primary' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
              onlyStarred && 'translate-x-5'
            )}
          />
        </button>
      </label>
    </div>
  );
}

// ─── Inline Card Editor ─────────────────────────────────────────────────────
interface InlineCardEditorProps {
  card: FlashcardData;
  onSave: (term: string, definition: string) => void;
  onCancel: () => void;
}

function InlineCardEditor({ card, onSave, onCancel }: InlineCardEditorProps) {
  const [term, setTerm] = useState(card.term);
  const [definition, setDefinition] = useState(card.definition);

  return (
    <div className="absolute inset-0 z-40 bg-card rounded-2xl border border-primary/50 flex flex-col items-center justify-center gap-4 p-8">
      <h3 className="text-sm font-semibold text-muted-foreground">Edit Card</h3>
      <div className="w-full max-w-md space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Term</label>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Definition</label>
          <Input value={definition} onChange={(e) => setDefinition(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(term, definition)} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Main Viewer Component ──────────────────────────────────────────────────

export interface FlashcardViewerProps {
  deck: FlashcardDeckData;
  onClose?: () => void;
  onEdit?: () => void;
}

export function FlashcardViewer({ deck: initialDeck, onClose, onEdit }: FlashcardViewerProps) {
  const [deck, setDeck] = useState<FlashcardDeckData>(initialDeck);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardSorting, setCardSorting] = useState(false);
  const [starredCards, setStarredCards] = useState<Set<string>>(new Set());
  const [studyMode, setStudyMode] = useState<StudyMode>('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTermFirst, setShowTermFirst] = useState(true);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [editingCard, setEditingCard] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Derive visible cards based on filters
  const visibleCards = useMemo(() => {
    let cards = deck.cards;
    if (onlyStarred && starredCards.size > 0) {
      cards = cards.filter((c) => starredCards.has(c.id));
    }
    if (cardSorting) {
      cards = [...cards].sort((a, b) => a.term.localeCompare(b.term));
    }
    if (shuffledOrder && !cardSorting) {
      // Apply shuffle if active
      const indexed = shuffledOrder
        .map((i) => deck.cards[i])
        .filter(Boolean)
        .filter((c) => !onlyStarred || starredCards.has(c.id));
      if (indexed.length > 0) cards = indexed;
    }
    return cards;
  }, [deck.cards, onlyStarred, starredCards, cardSorting, shuffledOrder]);

  const totalCards = visibleCards.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, totalCards - 1));
  const currentCard = visibleCards[safeIndex];

  // What's displayed on front vs back
  const frontText = showTermFirst ? currentCard?.term : currentCard?.definition;
  const backText = showTermFirst ? currentCard?.definition : currentCard?.term;

  // Navigation
  const goToNext = useCallback(() => {
    if (safeIndex < totalCards - 1) {
      setCurrentIndex(safeIndex + 1);
      setIsFlipped(false);
      setHintText(null);
    }
  }, [safeIndex, totalCards]);

  const goToPrev = useCallback(() => {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      setIsFlipped(false);
      setHintText(null);
    }
  }, [safeIndex]);

  const toggleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const toggleStar = useCallback(() => {
    if (!currentCard) return;
    setStarredCards((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) {
        next.delete(currentCard.id);
      } else {
        next.add(currentCard.id);
      }
      return next;
    });
  }, [currentCard]);

  // True Fisher-Yates shuffle of all cards
  const handleShuffle = useCallback(() => {
    const indices = Array.from({ length: deck.cards.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledOrder(indices);
    setCurrentIndex(0);
    setIsFlipped(false);
    setHintText(null);
  }, [deck.cards.length]);

  // Text-to-Speech
  const speakCurrentCard = useCallback(() => {
    if (!currentCard) return;
    const text = isFlipped ? backText : frontText;
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, [currentCard, isFlipped, frontText, backText]);

  // Get a Hint (AI-powered)
  const getHint = useCallback(async () => {
    if (!currentCard || hintLoading) return;
    setHintLoading(true);
    try {
      const response = await groqAPI.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful study assistant. Give a short, clever hint (1-2 sentences) that helps the student remember the definition without directly giving it away. Be creative — use analogies, first-letter clues, or associations.',
          },
          {
            role: 'user',
            content: `Give me a hint for this flashcard:\nTerm: "${currentCard.term}"\nDefinition: "${currentCard.definition}"`,
          },
        ],
        maxTokens: 120,
        temperature: 0.8,
      });
      setHintText(response.content);
    } catch (err: any) {
      setHintText(`Hint: Think about the first letter "${currentCard.definition.charAt(0).toUpperCase()}"...`);
    } finally {
      setHintLoading(false);
    }
  }, [currentCard, hintLoading]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Inline card save
  const handleCardSave = useCallback(
    (term: string, definition: string) => {
      if (!currentCard) return;
      setDeck((prev) => ({
        ...prev,
        cards: prev.cards.map((c) => (c.id === currentCard.id ? { ...c, term, definition } : c)),
      }));
      setEditingCard(false);
    },
    [currentCard]
  );

  // Add tag
  const handleAddTag = useCallback(() => {
    if (!newTag.trim()) return;
    setDeck((prev) => ({
      ...prev,
      tags: [...prev.tags, newTag.trim()],
    }));
    setNewTag('');
    setAddingTag(false);
  }, [newTag]);

  // Remove tag
  const handleRemoveTag = useCallback((tag: string) => {
    setDeck((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  // Keyboard navigation (only in default mode)
  useEffect(() => {
    if (studyMode !== 'default') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when editing
      if (editingCard || addingTag) return;
      if (e.key === 'ArrowRight' || e.key === 'd') goToNext();
      else if (e.key === 'ArrowLeft' || e.key === 'a') goToPrev();
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleFlip();
      } else if (e.key === 's') toggleStar();
      else if (e.key === 'h') getHint();
      else if (e.key === 'Escape' && isFullscreen) toggleFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, toggleFlip, toggleStar, getHint, studyMode, editingCard, addingTag, isFullscreen, toggleFullscreen]);

  // ── Render study modes ─────────────────────────────────────────────────
  if (studyMode === 'learn') {
    return (
      <div ref={containerRef} className="h-full bg-background">
        <LearnMode cards={deck.cards} onExit={() => setStudyMode('default')} />
      </div>
    );
  }
  if (studyMode === 'match') {
    return (
      <div ref={containerRef} className="h-full bg-background">
        <MatchMode cards={deck.cards} onExit={() => setStudyMode('default')} />
      </div>
    );
  }
  if (studyMode === 'spaced-repetition') {
    return (
      <div ref={containerRef} className="h-full bg-background">
        <SpacedRepetitionMode cards={deck.cards} onExit={() => setStudyMode('default')} />
      </div>
    );
  }
  if (studyMode === 'ai-chat') {
    return (
      <div ref={containerRef} className="h-full bg-background">
        <AIChatMode deck={deck} onExit={() => setStudyMode('default')} />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (deck.cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Brain className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <h2 className="text-xl font-semibold">No cards in this deck</h2>
          <p className="text-muted-foreground">Add some flashcards to start studying!</p>
          {onEdit && (
            <Button onClick={onEdit} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Flashcards
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Default flashcard view ─────────────────────────────────────────────
  return (
    <div ref={containerRef} className="h-full flex flex-col bg-background overflow-auto">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -ml-2">
                  <X className="h-5 w-5" />
                </Button>
              )}
              <h1 className="text-2xl font-bold">{deck.title}</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      'h-3.5 w-3.5',
                      s <= starredCards.size
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
              <span>({starredCards.size})</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              <span>{deck.cards.length} cards</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" className="gap-2" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Edit flashcards
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Study Mode Grid */}
      <div className="px-6 pb-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <StudyModeCard
            icon={<Sparkles className="h-5 w-5 text-purple-400" />}
            label="AI Chat"
            badge="✦"
            onClick={() => setStudyMode('ai-chat')}
          />
          <StudyModeCard
            icon={<Brain className="h-5 w-5 text-pink-400" />}
            label="Learn"
            onClick={() => setStudyMode('learn')}
          />
          <StudyModeCard
            icon={<Timer className="h-5 w-5 text-cyan-400" />}
            label="Spaced Repetition"
            onClick={() => setStudyMode('spaced-repetition')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StudyModeCard
            icon={<Zap className="h-5 w-5 text-red-400" />}
            label="Match"
            onClick={() => setStudyMode('match')}
          />
          <StudyModeCard
            icon={<FlipHorizontal className="h-5 w-5 text-indigo-400" />}
            label="Flashcards"
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setShuffledOrder(null);
              setHintText(null);
            }}
          />
        </div>
      </div>

      {/* Flashcard Display */}
      <div className="px-6 pb-4 flex-1 flex flex-col">
        {/* Card tools row */}
        <div className="flex justify-end gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-8"
            onClick={getHint}
            disabled={hintLoading}
          >
            {hintLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lightbulb className="h-3.5 w-3.5" />
            )}
            Get a hint
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={speakCurrentCard} title="Read aloud">
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingCard(true)} title="Edit card">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleStar}
            title="Star card"
          >
            <Star
              className={cn(
                'h-4 w-4',
                currentCard && starredCards.has(currentCard.id)
                  ? 'fill-yellow-400 text-yellow-400'
                  : ''
              )}
            />
          </Button>
        </div>

        {/* Hint display */}
        {hintText && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-200/90">{hintText}</p>
            <button onClick={() => setHintText(null)} className="ml-auto shrink-0">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* The flip card */}
        <div
          className="flex-1 min-h-[300px] cursor-pointer perspective-1000 relative"
          onClick={() => !editingCard && toggleFlip()}
        >
          {editingCard && currentCard ? (
            <InlineCardEditor
              card={currentCard}
              onSave={handleCardSave}
              onCancel={() => setEditingCard(false)}
            />
          ) : (
            <div
              className={cn(
                'relative w-full h-full transition-transform duration-500 transform-style-3d',
                isFlipped && 'rotate-y-180'
              )}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden rounded-2xl bg-card border border-border/50 flex items-center justify-center p-8">
                <p className="text-2xl font-medium text-center select-none">{frontText}</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl bg-card border border-border/50 flex items-center justify-center p-8">
                <p className="text-xl text-center select-none">{backText}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
          {/* Card sorting toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Card Sorting</span>
            <button
              onClick={() => {
                setCardSorting(!cardSorting);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors',
                cardSorting ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                  cardSorting && 'translate-x-5'
                )}
              />
            </button>
          </div>

          {/* Prev / Counter / Next */}
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrev}
              disabled={safeIndex === 0}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {safeIndex + 1}/{totalCards}
            </span>
            <button
              onClick={goToNext}
              disabled={safeIndex === totalCards - 1}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 relative">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', onlyStarred && 'text-yellow-400')}
              onClick={() => {
                setOnlyStarred(!onlyStarred);
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              title={onlyStarred ? 'Show all cards' : 'Show starred only'}
            >
              <Star className={cn('h-4 w-4', onlyStarred && 'fill-yellow-400')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShuffle} title="Shuffle cards">
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9', showSettings && 'bg-muted')}
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            {showSettings && (
              <SettingsPanel
                showTermFirst={showTermFirst}
                setShowTermFirst={setShowTermFirst}
                onlyStarred={onlyStarred}
                setOnlyStarred={(v) => {
                  setOnlyStarred(v);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Description & Tags */}
      <div className="px-6 py-5 border-t border-border/30">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Description and Tags</h3>
            {deck.description && (
              <p className="text-sm text-muted-foreground">{deck.description}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {deck.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs group/tag cursor-default"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {addingTag ? (
                <div className="flex items-center gap-1">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                      if (e.key === 'Escape') {
                        setAddingTag(false);
                        setNewTag('');
                      }
                    }}
                    placeholder="Tag name"
                    className="w-24 text-xs px-2 py-0.5 rounded-full border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button onClick={handleAddTag}>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  </button>
                  <button onClick={() => { setAddingTag(false); setNewTag(''); }}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTag(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-full px-2.5 py-0.5"
                >
                  Add tags <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlashcardViewer;
