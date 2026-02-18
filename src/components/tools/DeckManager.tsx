import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Sparkles } from 'lucide-react';

interface DeckManagerProps {
  onDeckSelect?: (deckId: string) => void;
  selectedDeckId?: string;
  onStudyDeck?: (deckId: string) => void;
}

export default function DeckManager({ onDeckSelect, selectedDeckId, onStudyDeck }: DeckManagerProps) {
  return (
    <Card className="border-dashed border-2 border-muted">
      <CardContent className="p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-950">
            <Brain className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Flashcards Coming Soon
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              We're redesigning our flashcard system to be more powerful and intuitive. 
              The new version will include spaced repetition, AI-powered card generation, 
              and better organization features.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
