import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GroqAPI } from '@/lib/groq';
import {
  Globe,
  Check,
  Search,
  Plus,
  X,
  Sparkles,
  ChevronRight,
  Image,
  Mic,
  Trash2,
  ArrowLeftRight,
  RefreshCw,
  Settings,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Link2,
  Code,
  Subscript,
  Superscript,
  Undo,
  Redo,
  Paperclip,
  Pi,
  Phone,
  MessageCircle,
  MoreVertical,
  Pilcrow,
  Loader2,
} from 'lucide-react';

// Types
interface FlashcardData {
  id: string;
  term: string;
  definition: string;
  termImage?: string;
  definitionImage?: string;
  termAudio?: string;
  definitionAudio?: string;
}

interface FlashcardDeckData {
  id: string;
  title: string;
  description: string;
  tags: string[];
  cards: FlashcardData[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Flashcard Editor Toolbar Component
function EditorToolbar() {
  return (
    <div className="flex items-center gap-0.5 p-1.5 bg-muted/50 rounded-lg border border-border/50">
      <TooltipProvider delayDuration={300}>
        <ToolbarButton icon={<Pilcrow className="h-4 w-4" />} tooltip="Paragraph style" hasDropdown />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton icon={<Bold className="h-4 w-4" />} tooltip="Bold" />
        <ToolbarButton icon={<Italic className="h-4 w-4" />} tooltip="Italic" />
        <ToolbarButton icon={<Underline className="h-4 w-4" />} tooltip="Underline" />
        <ToolbarButton icon={<Strikethrough className="h-4 w-4" />} tooltip="Strikethrough" />
        <ToolbarButton icon={<Highlighter className="h-4 w-4" />} tooltip="Highlight" />
        <ToolbarButton icon={<Link2 className="h-4 w-4" />} tooltip="Add link" />
        <ToolbarButton icon={<Code className="h-4 w-4" />} tooltip="Code" />
        <ToolbarButton icon={<Subscript className="h-4 w-4" />} tooltip="Subscript" />
        <ToolbarButton icon={<Superscript className="h-4 w-4" />} tooltip="Superscript" />
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton icon={<Undo className="h-4 w-4" />} tooltip="Undo" />
        <ToolbarButton icon={<Redo className="h-4 w-4" />} tooltip="Redo" />
      </TooltipProvider>
    </div>
  );
}

function ToolbarButton({ 
  icon, 
  tooltip, 
  hasDropdown = false,
  active = false,
}: { 
  icon: React.ReactNode; 
  tooltip: string;
  hasDropdown?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            "p-1.5 rounded hover:bg-background/80 transition-colors flex items-center gap-0.5",
            active && "bg-background text-primary"
          )}
        >
          {icon}
          {hasDropdown && <ChevronRight className="h-3 w-3 rotate-90 opacity-50" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// Individual Flashcard Card Component
interface FlashcardCardProps {
  card: FlashcardData;
  index: number;
  onUpdate: (id: string, updates: Partial<FlashcardData>) => void;
  onDelete: (id: string) => void;
  onSwap: (id: string) => void;
  onAIGenerate: (id: string, type: 'term' | 'definition') => void;
  onDuplicate: (id: string) => void;
}

function FlashcardCard({
  card,
  index,
  onUpdate,
  onDelete,
  onSwap,
  onAIGenerate,
  onDuplicate,
}: FlashcardCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 flex items-center justify-center bg-muted rounded-lg text-sm font-medium">
            {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onAIGenerate(card.id, 'definition')}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>AI Generate Definition</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSwap(card.id)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Swap Term & Definition</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDuplicate(card.id)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Duplicate Card</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDelete(card.id)}
                  className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete Card</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 flex justify-center">
        <EditorToolbar />
      </div>

      {/* Term & Definition Fields */}
      <div className="p-4 pt-0 space-y-4">
        {/* Term */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-2">
            <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-muted/50 hover:bg-muted rounded-lg transition-colors">
              <Image className="h-3.5 w-3.5" />
              Image
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-muted/50 hover:bg-muted rounded-lg transition-colors">
              <Mic className="h-3.5 w-3.5" />
              Record
            </button>
          </div>
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={card.term}
              onChange={(e) => onUpdate(card.id, { term: e.target.value })}
              placeholder='"space" for AI, "/" for format'
              className="w-full bg-transparent border-b border-border/50 pb-2 text-sm !text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">Term</p>
          </div>
        </div>

        {/* Definition */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-2">
            <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-muted/50 hover:bg-muted rounded-lg transition-colors">
              <Image className="h-3.5 w-3.5" />
              Image
            </button>
            <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-muted/50 hover:bg-muted rounded-lg transition-colors">
              <Mic className="h-3.5 w-3.5" />
              Record
            </button>
          </div>
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={card.definition}
              onChange={(e) => onUpdate(card.id, { definition: e.target.value })}
              placeholder='"space" for AI, "/" for format'
              className="w-full bg-transparent border-b border-border/50 pb-2 text-sm !text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-muted-foreground">Definition</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Kai AI Chat Sidebar Component
interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  cardsAdded?: number; // track how many cards were added from this message
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCardsGenerated: (cards: FlashcardData[]) => void;
  currentTitle: string;
  currentCards: FlashcardData[];
}

const FLASHCARD_SYSTEM_PROMPT = `You are Kai, a helpful AI assistant that creates flashcards for students.

IMPORTANT RULES:
1. When asked to create/generate flashcards, you MUST respond with ONLY a valid JSON array. No extra text before or after.
2. Each item must have "term" and "definition" fields.
3. Generate 5-10 cards by default unless the user specifies a count.
4. Make definitions clear, concise, and educational.
5. For fill-in-the-blank, put the sentence with a blank (___) as "term" and the answer as "definition".
6. For Q&A, put the question as "term" and the answer as "definition".
7. If the user asks a general question (not requesting flashcard generation), respond conversationally in plain text. Do NOT wrap conversational answers in JSON.

Example flashcard response:
[{"term": "Mitosis", "definition": "A type of cell division that results in two identical daughter cells"}, {"term": "Meiosis", "definition": "A type of cell division that reduces the chromosome number by half, producing four gamete cells"}]`;

function AIChatSidebar({ isOpen, onToggle, onCardsGenerated, currentTitle, currentCards }: AIChatSidebarProps) {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const groqRef = useRef(new GroqAPI());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const suggestions = [
    { label: 'Create flashcards on a topic', prompt: 'Create 5 flashcards about ' },
    { label: 'Fill in the blank cards', prompt: 'Create 5 fill-in-the-blank flashcards about ' },
    { label: 'Q & A flashcards', prompt: 'Create 5 question and answer flashcards about ' },
  ];

  const parseFlashcardsFromResponse = (text: string): FlashcardData[] | null => {
    // Try to find and parse a JSON array from the response
    try {
      // First try: the whole response is JSON
      const trimmed = text.trim();
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].term !== undefined) {
          return parsed.map((item: any) => ({
            id: crypto.randomUUID(),
            term: String(item.term || '').trim(),
            definition: String(item.definition || '').trim(),
          })).filter((c: FlashcardData) => c.term && c.definition);
        }
      }
    } catch {}

    // Second try: extract JSON array from within text (e.g. if model adds explanation around it)
    try {
      const jsonMatch = text.match(/\[[\s\S]*?\](?=\s*$|\s*\n|$)/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].term !== undefined) {
          return parsed.map((item: any) => ({
            id: crypto.randomUUID(),
            term: String(item.term || '').trim(),
            definition: String(item.definition || '').trim(),
          })).filter((c: FlashcardData) => c.term && c.definition);
        }
      }
    } catch {}

    // Third try: look for ```json code blocks
    try {
      const codeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].term !== undefined) {
          return parsed.map((item: any) => ({
            id: crypto.randomUUID(),
            term: String(item.term || '').trim(),
            definition: String(item.definition || '').trim(),
          })).filter((c: FlashcardData) => c.term && c.definition);
        }
      }
    } catch {}

    return null;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: text.trim(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setMessage('');
    setIsLoading(true);

    try {
      // Build context about current deck state
      let deckContext = '';
      if (currentTitle) {
        deckContext += `The user's deck is titled "${currentTitle}". `;
      }
      if (currentCards.length > 0) {
        const filledCards = currentCards.filter(c => c.term || c.definition);
        if (filledCards.length > 0) {
          deckContext += `The deck has ${filledCards.length} existing cards:\n`;
          deckContext += filledCards.map((c, i) => `${i + 1}. Term: "${c.term}" → Definition: "${c.definition}"`).join('\n');
          deckContext += '\n\nDo not duplicate existing cards. Generate NEW cards only.\n\n';
        }
      }

      // Build conversation history for context (last 6 messages max to save tokens)
      const recentHistory = chatHistory.slice(-6);
      const conversationMessages = recentHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

      const response = await groqRef.current.chat({
        messages: [
          { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
          ...(deckContext ? [{ role: 'user' as const, content: `[Context] ${deckContext}` }, { role: 'assistant' as const, content: 'Got it, I understand the current deck state.' }] : []),
          ...conversationMessages,
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.7,
        maxTokens: 2000,
      });

      // Try to parse flashcards from the response
      const parsedCards = parseFlashcardsFromResponse(response.content);

      let displayContent = response.content;
      let cardsAdded = 0;

      if (parsedCards && parsedCards.length > 0) {
        // Successfully parsed flashcards — add them
        onCardsGenerated(parsedCards);
        cardsAdded = parsedCards.length;
        // Show a friendly summary instead of raw JSON
        displayContent = `✅ Added ${parsedCards.length} flashcard${parsedCards.length > 1 ? 's' : ''} to your deck!\n\n${parsedCards.map((c, i) => `**${i + 1}.** ${c.term} → ${c.definition}`).join('\n')}`;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: displayContent,
        cardsAdded,
      };

      setChatHistory((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: `⚠️ ${error instanceof Error ? error.message : 'Something went wrong. Please try again.'}`,
      };
      setChatHistory((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: { label: string; prompt: string }) => {
    setMessage(suggestion.prompt);
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setMessage('');
  };

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center w-12 border-l border-border bg-card/30 h-full py-4 gap-3">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Open AI Chat"
        >
          <Sparkles className="h-5 w-5 text-purple-400" />
        </button>
        <span className="text-[10px] text-muted-foreground [writing-mode:vertical-lr] rotate-180 tracking-wider">AI CHAT</span>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/30">
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          title="Minimize sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full text-sm font-medium">
          <Sparkles className="h-4 w-4 text-purple-400" />
          Kai
        </div>
        <button 
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          onClick={handleClearChat}
          title="Clear chat"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Chat Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {chatHistory.length === 0 ? (
            <>
              <p className="text-xs text-muted-foreground text-center mb-4">Ask Kai to generate flashcards for any topic</p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full flex items-center gap-3 p-3 text-left text-sm bg-muted/30 hover:bg-muted/50 rounded-xl border border-border/30 transition-colors"
                >
                  <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <span className="text-muted-foreground">{suggestion.label}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'p-3 rounded-xl text-sm',
                    msg.type === 'user'
                      ? 'bg-primary/10 text-foreground ml-6'
                      : 'bg-muted/50 text-foreground mr-2'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {msg.type === 'assistant' && (
                      <Sparkles className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl mr-2">
                  <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                  <span className="text-sm text-muted-foreground">Kai is thinking...</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(message);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask Kai to create flashcards..."
            className="flex-1 bg-background/50"
            style={{ color: '#000' }}
            disabled={isLoading}
          />
          <button 
            type="submit"
            disabled={!message.trim() || isLoading}
            className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4 -rotate-90" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// Main Flashcard Creator Component
export interface FlashcardCreatorProps {
  onClose?: () => void;
  onSave?: (deck: FlashcardDeckData) => void | Promise<void>;
  folderId?: string;
  /** When provided, the creator opens in edit mode with the deck's existing data */
  initialDeck?: FlashcardDeckData;
}

export function FlashcardCreator({ onClose, onSave, folderId, initialDeck }: FlashcardCreatorProps) {
  const [title, setTitle] = useState(initialDeck?.title ?? '');
  const [description, setDescription] = useState(initialDeck?.description ?? '');
  const [tags, setTags] = useState<string[]>(initialDeck?.tags ?? []);
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [cards, setCards] = useState<FlashcardData[]>(
    initialDeck?.cards?.length
      ? initialDeck.cards.map((c) => ({ id: c.id, term: c.term, definition: c.definition }))
      : [{ id: crypto.randomUUID(), term: '', definition: '' }]
  );

  // Generate unique ID
  const generateId = useCallback(() => crypto.randomUUID(), []);

  // Add new card
  const addCard = useCallback(() => {
    setCards((prev) => [...prev, { id: generateId(), term: '', definition: '' }]);
  }, [generateId]);

  // Update card
  const updateCard = useCallback((id: string, updates: Partial<FlashcardData>) => {
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...updates } : card))
    );
  }, []);

  // Delete card
  const deleteCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  // Swap term and definition
  const swapCard = useCallback((id: string) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id
          ? { ...card, term: card.definition, definition: card.term }
          : card
      )
    );
  }, []);

  // Duplicate card
  const duplicateCard = useCallback((id: string) => {
    setCards((prev) => {
      const cardIndex = prev.findIndex((c) => c.id === id);
      if (cardIndex === -1) return prev;
      const card = prev[cardIndex];
      const newCard = { ...card, id: generateId() };
      const newCards = [...prev];
      newCards.splice(cardIndex + 1, 0, newCard);
      return newCards;
    });
  }, [generateId]);

  // AI generate (placeholder)
  const handleAIGenerate = useCallback((id: string, type: 'term' | 'definition') => {
    // TODO: Implement AI generation
    console.log('AI Generate:', id, type);
  }, []);

  // Handle cards generated by AI
  const handleCardsGenerated = useCallback((newCards: FlashcardData[]) => {
    setCards((prev) => {
      // Remove empty cards
      const nonEmptyCards = prev.filter((c) => c.term || c.definition);
      // Add new AI-generated cards
      return [...nonEmptyCards, ...newCards];
    });
  }, []);

  // Add tag
  const addTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags((prev) => [...prev, newTag.trim()]);
      setNewTag('');
      setShowTagInput(false);
    }
  }, [newTag, tags]);

  // Remove tag
  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // Save deck
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const deck: FlashcardDeckData = {
      id: initialDeck?.id ?? generateId(),
      title: title || 'Untitled Deck',
      description,
      tags,
      cards: cards.filter((c) => c.term || c.definition),
      isPublic: initialDeck?.isPublic ?? false,
      createdAt: initialDeck?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    setIsSaving(true);
    try {
      await onSave?.(deck);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [title, description, tags, cards, generateId, onSave, isSaving, initialDeck]);

  // Filter cards by search
  const filteredCards = searchQuery
    ? cards.filter(
        (card) =>
          card.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
          card.definition.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cards;

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="flex h-full bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border/30">
          <div className="flex items-center gap-4 mb-4">
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
                <X className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-semibold">{initialDeck ? 'Edit flashcards' : 'Create flashcards below!'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isSaving ? 'Saving...' : initialDeck ? 'Save Changes' : 'Save & Create'}
            </Button>
            <span className="text-sm text-muted-foreground">{formatTimeAgo(lastSaved)}</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Title & Tags */}
            <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="flex-1 space-y-1.5">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder='Enter a title, like "Chemistry"'
                    className="bg-white dark:bg-background/50"
                    style={{ color: '#000' }}
                  />
                </div>
                <div className="pt-6">
                  {showTagInput ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Tag name"
                        className="h-9 w-32 bg-white dark:bg-background/50"
                        style={{ color: '#000' }}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" onClick={() => setShowTagInput(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTagInput(true)}
                      className="gap-1"
                    >
                      Add tags <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 p-0.5 rounded hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  className="bg-white dark:bg-background/50"
                  style={{ color: '#000' }}
                />
              </div>
            </div>

            {/* Search & Settings */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search terms/definitions"
                  className="pl-9 bg-white dark:bg-background/50"
                  style={{ color: '#000' }}
                />
              </div>
            </div>

            {/* Flashcards */}
            <div className="space-y-4">
              {filteredCards.map((card, index) => (
                <FlashcardCard
                  key={card.id}
                  card={card}
                  index={index}
                  onUpdate={updateCard}
                  onDelete={deleteCard}
                  onSwap={swapCard}
                  onDuplicate={duplicateCard}
                  onAIGenerate={handleAIGenerate}
                />
              ))}
            </div>

            {/* Add Card Button */}
            <button
              onClick={addCard}
              className="w-full p-4 border-2 border-dashed border-border/50 rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Add Card
            </button>
          </div>
        </ScrollArea>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatSidebar 
        isOpen={isChatOpen} 
        onToggle={() => setIsChatOpen(!isChatOpen)}
        onCardsGenerated={handleCardsGenerated}
        currentTitle={title}
        currentCards={cards}
      />
    </div>
  );
}

export default FlashcardCreator;
