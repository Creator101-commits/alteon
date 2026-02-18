import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Brain,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { FlashcardViewer } from './FlashcardViewer';
import type { FlashcardDeckData } from './FlashcardViewer';
import { FlashcardCreator } from './FlashcardCreator';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/supabase-storage';
import type { FlashcardDeck, Flashcard } from '@shared/schema';

// Format a Date as a relative time string
function timeAgo(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// Deck card in the list
interface DeckCardProps {
  deck: FlashcardDeck;
  onOpen: () => void;
  onDelete: () => void;
}

function DeckCard({ deck, onOpen, onDelete }: DeckCardProps) {
  return (
    <Card
      className="group cursor-pointer hover:border-primary/40 transition-colors"
      onClick={onOpen}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </div>
        <h3 className="font-semibold text-sm mb-1 line-clamp-1">{deck.title}</h3>
        {deck.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{deck.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {deck.cardCount ?? 0} cards
          </span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(deck.updatedAt)}
          </span>
        </div>
        {(deck.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {deck.tags!.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {deck.tags!.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{deck.tags!.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Convert Supabase FlashcardDeck + Flashcard[] into the FlashcardDeckData shape the viewer expects */
function toViewerDeck(deck: FlashcardDeck, cards: Flashcard[]): FlashcardDeckData {
  return {
    id: deck.id,
    title: deck.title,
    description: deck.description ?? '',
    tags: deck.tags ?? [],
    cards: cards.map((c) => ({
      id: c.id,
      term: c.term,
      definition: c.definition,
      termImage: c.termImage ?? undefined,
      definitionImage: c.definitionImage ?? undefined,
      termAudio: c.termAudio ?? undefined,
      definitionAudio: c.definitionAudio ?? undefined,
    })),
    isPublic: deck.isPublic ?? false,
    createdAt: typeof deck.createdAt === 'string' ? new Date(deck.createdAt) : deck.createdAt ?? new Date(),
    updatedAt: typeof deck.updatedAt === 'string' ? new Date(deck.updatedAt) : deck.updatedAt ?? new Date(),
  };
}

export const Flashcards = () => {
  const { user } = useAuth();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDeck, setViewingDeck] = useState<FlashcardDeckData | null>(null);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeckData | null>(null);
  const [search, setSearch] = useState('');

  // Load decks from Supabase
  const fetchDecks = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await storage.getFlashcardDecksByUserId(user.uid);
      setDecks(data);
    } catch (err) {
      console.error('Error loading flashcard decks:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  // Open a deck: fetch its cards then show viewer
  const openDeck = useCallback(async (deck: FlashcardDeck) => {
    try {
      const cards = await storage.getFlashcardsByDeckId(deck.id);
      setViewingDeck(toViewerDeck(deck, cards));
    } catch (err) {
      console.error('Error loading flashcard cards:', err);
    }
  }, []);

  // Delete a deck
  const handleDelete = useCallback(async (id: string) => {
    try {
      await storage.deleteFlashcardDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Error deleting deck:', err);
    }
  }, []);

  const filtered = search
    ? decks.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          (d.tags ?? []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : decks;

  // Save handler for editing existing deck
  const handleEditSave = useCallback(async (updatedDeckData: FlashcardDeckData) => {
    if (!user?.uid) return;
    try {
      // Update the deck metadata
      await storage.updateFlashcardDeck(updatedDeckData.id, {
        title: updatedDeckData.title,
        description: updatedDeckData.description,
        tags: updatedDeckData.tags,
      });

      // Delete existing cards and re-create them
      const existingCards = await storage.getFlashcardsByDeckId(updatedDeckData.id);
      for (const card of existingCards) {
        await storage.deleteFlashcard(card.id);
      }
      for (const card of updatedDeckData.cards) {
        await storage.createFlashcard({
          deckId: updatedDeckData.id,
          term: card.term,
          definition: card.definition,
          position: updatedDeckData.cards.indexOf(card),
        });
      }

      // Go back to the viewer with refreshed data
      const freshCards = await storage.getFlashcardsByDeckId(updatedDeckData.id);
      const freshDecks = await storage.getFlashcardDecksByUserId(user.uid);
      const freshDeck = freshDecks.find((d) => d.id === updatedDeckData.id);
      if (freshDeck) {
        setEditingDeck(null);
        setViewingDeck(toViewerDeck(freshDeck, freshCards));
      } else {
        setEditingDeck(null);
      }
      fetchDecks();
    } catch (err) {
      console.error('Error saving edited deck:', err);
    }
  }, [user?.uid, fetchDecks]);

  // Full-screen editor
  if (editingDeck) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <FlashcardCreator
          initialDeck={editingDeck}
          onClose={() => {
            // Go back to the viewer
            setEditingDeck(null);
            if (viewingDeck) {
              // Re-open viewer with latest data
              const deckObj = decks.find((d) => d.id === editingDeck.id);
              if (deckObj) {
                openDeck(deckObj);
              }
            }
          }}
          onSave={handleEditSave}
        />
      </div>
    );
  }

  // Full-screen viewer
  if (viewingDeck) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <FlashcardViewer
          deck={viewingDeck}
          onClose={() => {
            setViewingDeck(null);
            fetchDecks(); // Refresh list when coming back
          }}
          onEdit={() => {
            // Open the editor with the current deck's data
            setEditingDeck(viewingDeck);
          }}
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your flashcard decks...</p>
      </div>
    );
  }

  // Empty state
  if (decks.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 flex flex-col items-center justify-center gap-4 py-20">
        <div className="p-4 rounded-full bg-primary/10">
          <Brain className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No flashcard decks yet</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Create your first flashcard deck from the <strong>Files</strong> tab by clicking{' '}
          <strong>New &rarr; Flashcards &rarr; Create from scratch</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            {decks.length} deck{decks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchDecks}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search decks..."
              className="pl-9 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-56"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deck grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((deck) => (
          <DeckCard
            key={deck.id}
            deck={deck}
            onOpen={() => openDeck(deck)}
            onDelete={() => handleDelete(deck.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && search && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No decks matching &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
};

export default Flashcards;
