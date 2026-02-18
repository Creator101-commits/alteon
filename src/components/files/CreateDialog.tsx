import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { FlashcardCreator } from '@/components/tools/FlashcardCreator';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/supabase-storage';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  FileText,
  Folder,
  Sparkles,
  PenLine,
  Download,
  X,
} from 'lucide-react';

type Category = 'flashcards' | 'notes' | 'folder';

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNote: () => void;
  onCreateFolder: (name: string) => void;
  onFilesChanged?: () => void;
  defaultCategory?: Category;
}

interface CategoryItem {
  id: Category;
  label: string;
  icon: React.ReactNode;
}

const categories: CategoryItem[] = [
  { id: 'flashcards', label: 'Flashcards', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
  { id: 'folder', label: 'Folder', icon: <Folder className="h-4 w-4" /> },
];

// Compact card component for options
interface OptionCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}

function OptionCard({ icon, iconBg, title, description, badge, onClick }: OptionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center text-center p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all"
    >
      <div className="relative mb-3">
        <div className={cn("p-2.5 rounded-lg", iconBg)}>
          {icon}
        </div>
        {badge && (
          <span className="absolute -top-1 -right-8 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 whitespace-nowrap">
            ✦ {badge}
          </span>
        )}
      </div>
      <h3 className="font-medium text-sm text-foreground mb-1 leading-tight">{title}</h3>
      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
    </button>
  );
}

export function CreateDialog({
  open,
  onOpenChange,
  onCreateNote,
  onCreateFolder,
  onFilesChanged,
  defaultCategory = 'flashcards',
}: CreateDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<Category>(defaultCategory);
  const [folderName, setFolderName] = useState('');
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentUploadMode, setDocumentUploadMode] = useState<'notes' | 'flashcards'>('notes');
  const [showFlashcardCreator, setShowFlashcardCreator] = useState(false);

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      onOpenChange(false);
    }
  };

  const openDocumentUpload = (mode: 'notes' | 'flashcards') => {
    setDocumentUploadMode(mode);
    setDocumentUploadOpen(true);
  };

  // If FlashcardCreator is open, render it as full screen overlay
  if (showFlashcardCreator) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <FlashcardCreator 
          onClose={() => {
            setShowFlashcardCreator(false);
            onOpenChange(false);
          }}
          onSave={async (deck) => {
            if (!user?.uid) {
              toast({ title: 'Not logged in', description: 'Please sign in to save flashcards.', variant: 'destructive' });
              return;
            }
            try {
              // Save deck + cards to Supabase
              await storage.saveFlashcardDeckWithCards(
                {
                  userId: user.uid,
                  title: deck.title,
                  description: deck.description,
                  tags: deck.tags,
                  isPublic: deck.isPublic,
                },
                deck.cards
                  .filter((c) => c.term || c.definition)
                  .map((c, i) => ({
                    term: c.term,
                    definition: c.definition,
                    termImage: c.termImage || null,
                    definitionImage: c.definitionImage || null,
                    termAudio: c.termAudio || null,
                    definitionAudio: c.definitionAudio || null,
                    position: i,
                  }))
              );
              toast({ title: 'Flashcard deck saved!', description: `"${deck.title}" with ${deck.cards.filter(c => c.term || c.definition).length} cards.` });
              onFilesChanged?.();
              setShowFlashcardCreator(false);
              onOpenChange(false);
            } catch (err: any) {
              console.error('Error saving deck to Supabase:', err);
              toast({
                title: 'Failed to save flashcards',
                description: err?.message || 'Something went wrong. Check the console for details.',
                variant: 'destructive',
              });
              // Do NOT close — let the user retry
            }
          }}
        />
      </div>
    );
  }

  const renderContent = () => {
    switch (selectedCategory) {
      case 'flashcards':
        return (
          <div className="grid grid-cols-3 gap-3">
            <OptionCard
              icon={<Sparkles className="h-4 w-4 text-purple-400" />}
              iconBg="bg-purple-500/20"
              title="Create from PDF, PPT, or Video"
              description="We'll create flashcards from your file"
              badge="Ultra"
              onClick={() => openDocumentUpload('flashcards')}
            />
            <OptionCard
              icon={<PenLine className="h-4 w-4 text-blue-400" />}
              iconBg="bg-blue-500/20"
              title="Create from scratch"
              description="Start creating your own flashcards"
              onClick={() => setShowFlashcardCreator(true)}
            />
          </div>
        );

      case 'notes':
        return (
          <div className="grid grid-cols-3 gap-3">
            <OptionCard
              icon={<Sparkles className="h-4 w-4 text-purple-400" />}
              iconBg="bg-purple-500/20"
              title="Create from PDF, PPT, or Video"
              description="We'll create notes from your file"
              badge="Ultra"
              onClick={() => openDocumentUpload('notes')}
            />
            <OptionCard
              icon={<FileText className="h-4 w-4 text-blue-400" />}
              iconBg="bg-blue-500/20"
              title="Create from scratch"
              description="Start writing your own notes"
              onClick={() => {
                onCreateNote();
                onOpenChange(false);
              }}
            />
          </div>
        );

      case 'folder':
        return (
          <div className="max-w-sm">
            <div className="flex flex-col items-center text-center p-6 rounded-xl border border-border/50 bg-card">
              <div className="p-3 rounded-lg bg-amber-500/20 mb-4">
                <Folder className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Create Folder</h3>
              <p className="text-sm text-muted-foreground mb-4">Organize your files in folders</p>
              
              <div className="w-full space-y-3">
                <div className="space-y-1.5 text-left">
                  <Label htmlFor="folder-name" className="text-xs">Folder name</Label>
                  <Input
                    id="folder-name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="h-9"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFolder();
                      }
                    }}
                  />
                </div>
                <Button onClick={handleCreateFolder} className="w-full h-9" size="sm">
                  Create Folder
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Coming soon...
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create New</DialogTitle>
          <DialogDescription>Choose what you want to create</DialogDescription>
        </DialogHeader>
        
        <div className="flex min-h-[400px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-muted/30 p-3">
            <nav className="space-y-0.5">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedCategory === category.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {category.icon}
                  {category.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold">Create</h2>
                <p className="text-sm text-muted-foreground">Navigate through the different categories</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 -mt-1 -mr-1"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {renderContent()}
          </div>
        </div>
      </DialogContent>

      {/* Document Upload Dialog */}
      <DocumentUploadDialog
        open={documentUploadOpen}
        onOpenChange={setDocumentUploadOpen}
        mode={documentUploadMode}
        onComplete={() => {
          onFilesChanged?.();
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}

export default CreateDialog;
