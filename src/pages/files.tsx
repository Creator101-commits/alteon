import React, { useState, useEffect, useCallback } from 'react';
import { FileTree, type FileItem } from '@/components/files/FileTree';
import { CreateDialog } from '@/components/files/CreateDialog';
import NoteEditor from '@/components/NoteEditor';
import Folder from '@/components/Folder';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/supabase-storage';
import { FileText, Plus, FolderOpen, FolderIcon, Layers, BookOpen, Clock, Trash2 } from 'lucide-react';
import type { Note, Folder as FolderType, FlashcardDeck, Flashcard } from '@shared/schema';
import { FlashcardViewer } from '@/components/tools/FlashcardViewer';
import type { FlashcardDeckData } from '@/components/tools/FlashcardViewer';
import { FlashcardCreator } from '@/components/tools/FlashcardCreator';

export const FilesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'editor'>('grid');
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'note' | 'flashcard-deck' } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [viewingDeck, setViewingDeck] = useState<FlashcardDeckData | null>(null);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeckData | null>(null);

  useEffect(() => {
    if (user?.uid) {
      loadAllFiles();
    }
  }, [user?.uid]);

  const loadAllFiles = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const [foldersData, notesData, decksData] = await Promise.all([
        storage.getFoldersByUserId(user.uid),
        storage.getNotesByUserId(user.uid),
        storage.getFlashcardDecksByUserId(user.uid),
      ]);
      
      setFolders(foldersData);
      setNotes(notesData);
      setFlashcardDecks(decksData);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectItem = (item: FileItem) => {
    setSelectedItem(item);
    
    // If it's a note, load the note content and switch to editor view
    if (item.type === 'note') {
      loadNote(item.id);
      setViewMode('editor');
    } else if (item.type === 'flashcard-deck') {
      openFlashcardDeck(item.id);
    } else if (item.type === 'folder') {
      // Show folder contents in grid view
      setViewMode('grid');
      setCurrentNote(null);
    } else {
      setCurrentNote(null);
      setViewMode('grid');
    }
  };

  // Helper: format relative time
  const timeAgo = (date: Date | string | null): string => {
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
  };

  // Open a flashcard deck in the viewer
  const openFlashcardDeck = useCallback(async (deckId: string) => {
    const deck = flashcardDecks.find(d => d.id === deckId);
    if (!deck) return;
    try {
      const cards = await storage.getFlashcardsByDeckId(deck.id);
      setViewingDeck({
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
      });
    } catch (err) {
      console.error('Error loading flashcard cards:', err);
      toast({
        title: 'Error',
        description: 'Failed to load flashcard deck',
        variant: 'destructive',
      });
    }
  }, [flashcardDecks, toast]);

  // Delete a flashcard deck
  const deleteFlashcardDeck = useCallback(async (id: string) => {
    try {
      await storage.deleteFlashcardDeck(id);
      setFlashcardDecks(prev => prev.filter(d => d.id !== id));
      toast({
        title: 'Success',
        description: 'Flashcard deck deleted',
      });
    } catch (err) {
      console.error('Error deleting deck:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete flashcard deck',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadNote = async (noteId: string) => {
    try {
      const note = await storage.getNote(noteId);
      if (note) {
        setCurrentNote(note);
      }
    } catch (error) {
      console.error('Error loading note:', error);
      toast({
        title: 'Error',
        description: 'Failed to load note',
        variant: 'destructive',
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'note' | 'flashcard-deck') => {
    e.stopPropagation();
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTargetId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) return;

    try {
      if (draggedItem.type === 'note') {
        const result = await storage.updateNote(draggedItem.id, { folderId });
        if (!result) {
          throw new Error('Failed to update note - folder_id column may not exist. Please apply the database migration.');
        }
      } else if (draggedItem.type === 'flashcard-deck') {
        const result = await storage.updateFlashcardDeck(draggedItem.id, { folderId });
        if (!result) {
          throw new Error('Failed to move flashcard deck.');
        }
      }
      toast({
        title: 'Success',
        description: folderId ? 'Moved to folder' : 'Moved to root',
      });
      
      // Reload all files to reflect the change
      await loadAllFiles();
    } catch (error: any) {
      console.error('Error moving item:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to move item',
        variant: 'destructive',
      });
    } finally {
      setDraggedItem(null);
      setDropTargetId(null);
    }
  };

  const createNewNote = async () => {
    if (!user?.uid) return;
    
    try {
      const note = await storage.createNote({
        userId: user.uid,
        title: 'Untitled Note',
        content: '',
        category: 'general',
      });
      
      setSelectedItem({
        id: note.id,
        type: 'note',
        name: note.title,
      });
      
      setCurrentNote(note);
      setViewMode('editor');
      
      toast({
        title: 'Success',
        description: 'New note created',
      });
      
      await loadAllFiles();
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to create note',
        variant: 'destructive',
      });
    }
  };

  const createNewFolder = async (name: string) => {
    if (!user?.uid) return;
    
    try {
      const folder = await storage.createFolder({
        userId: user.uid,
        name,
      });
      
      toast({
        title: 'Success',
        description: 'Folder created',
      });
      
      await loadAllFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        variant: 'destructive',
      });
    }
  };

  const renderContent = () => {
    // If viewing a note in editor mode
    if (viewMode === 'editor' && selectedItem?.type === 'note' && currentNote) {
      return (
        <div className="h-full">
          <NoteEditor
            note={currentNote}
            onSave={async (noteData) => {
              try {
                await storage.updateNote(selectedItem.id, noteData);
                await loadNote(selectedItem.id);
                await loadAllFiles();
                toast({
                  title: 'Success',
                  description: 'Note saved successfully',
                });
              } catch (error) {
                console.error('Error saving note:', error);
                throw error;
              }
            }}
            onClose={() => {
              setViewMode('grid');
              setSelectedItem(null);
              setCurrentNote(null);
            }}
            classes={[]}
          />
        </div>
      );
    }

    // Grid view showing folders, notes, and flashcard decks
    const displayItems = selectedItem?.type === 'folder' 
      ? {
          folders: folders.filter(f => f.parentFolderId === selectedItem.id),
          notes: notes.filter(n => n.folderId === selectedItem.id),
          decks: flashcardDecks.filter(d => d.folderId === selectedItem.id),
        }
      : {
          folders: folders.filter(f => !f.parentFolderId),
          notes: notes.filter(n => !n.folderId),
          decks: flashcardDecks.filter(d => !d.folderId),
        };

    const hasItems = displayItems.folders.length > 0 || displayItems.notes.length > 0 || displayItems.decks.length > 0;

    if (!hasItems) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {selectedItem ? 'Empty folder' : 'No files yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedItem 
                  ? 'This folder is empty. Create notes to get started.'
                  : 'Create folders or notes to organize your content'
                }
              </p>
              
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="h-full overflow-auto p-8"
        onDragOver={(e) => {
          if (draggedItem) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => handleDrop(e, null)}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {selectedItem?.name || 'All Files'}
            </h2>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {/* Folders */}
            {displayItems.folders.map(folder => (
              <div
                key={folder.id}
                className={`flex flex-col items-center cursor-pointer ${
                  dropTargetId === folder.id ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                onClick={() => handleSelectItem({ id: folder.id, type: 'folder', name: folder.name })}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <Folder
                  color={'#ffffff'}
                  size={1.2}
                  items={[
                    <div key="1" className="text-xs p-2">Files</div>,
                    <div key="2" className="text-xs p-2">Inside</div>,
                    <div key="3" className="text-xs p-2">Folder</div>
                  ]}
                />
                <p className="mt-2 text-sm font-medium text-center truncate w-full px-2">
                  {folder.name}
                </p>
              </div>
            ))}

            {/* Notes */}
            {displayItems.notes.map(note => {
              const preview = note.content
                ? note.content.replace(/<[^>]*>/g, '').slice(0, 60)
                : '';
              const dateStr = note.updatedAt
                ? (typeof note.updatedAt === 'string' ? new Date(note.updatedAt) : note.updatedAt).toLocaleDateString()
                : '';
              return (
                <div
                  key={note.id}
                  className={`flex flex-col cursor-move hover:scale-105 transition-transform group ${
                    draggedItem?.id === note.id ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, note.id, 'note')}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => {
                    if (!draggedItem) {
                      handleSelectItem({ id: note.id, type: 'note', name: note.title });
                    }
                  }}
                >
                  <Card className="w-full h-full hover:shadow-lg transition-shadow rounded-xl">
                    <CardContent className="p-4 flex flex-col gap-2">
                      <h3 className="font-semibold text-sm line-clamp-1">{note.title}</h3>
                      {note.category && (
                        <Badge variant="outline" className="w-fit text-[10px] px-2 py-0.5">
                          {note.category}
                        </Badge>
                      )}
                      {preview && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{preview}</p>
                      )}
                      <div className="border-t pt-2 mt-auto">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}

            {/* Flashcard Decks */}
          </div>

          {/* Flashcard Decks - wider cards in their own grid */}
          {displayItems.decks.length > 0 && (
            <>
              <h3 className="text-lg font-semibold mt-8 mb-4">Flashcard Decks</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayItems.decks.map(deck => (
              <div
                key={deck.id}
                className={`flex flex-col cursor-move group ${draggedItem?.id === deck.id ? 'opacity-50' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, deck.id, 'flashcard-deck')}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  if (!draggedItem) openFlashcardDeck(deck.id);
                }}
              >
                <Card className="w-full hover:border-primary/40 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFlashcardDeck(deck.id);
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
              </div>
            ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Save handler for editing an existing flashcard deck
  const handleEditDeckSave = useCallback(async (updatedDeckData: FlashcardDeckData) => {
    if (!user?.uid) return;
    try {
      await storage.updateFlashcardDeck(updatedDeckData.id, {
        title: updatedDeckData.title,
        description: updatedDeckData.description,
        tags: updatedDeckData.tags,
      });

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

      // Refresh and go back to viewer
      const freshCards = await storage.getFlashcardsByDeckId(updatedDeckData.id);
      const freshDecks = await storage.getFlashcardDecksByUserId(user.uid);
      const freshDeck = freshDecks.find((d) => d.id === updatedDeckData.id);
      if (freshDeck) {
        setEditingDeck(null);
        setViewingDeck({
          id: freshDeck.id,
          title: freshDeck.title,
          description: freshDeck.description ?? '',
          tags: freshDeck.tags ?? [],
          cards: freshCards.map((c) => ({ id: c.id, term: c.term, definition: c.definition })),
          isPublic: freshDeck.isPublic ?? false,
          createdAt: typeof freshDeck.createdAt === 'string' ? new Date(freshDeck.createdAt) : freshDeck.createdAt ?? new Date(),
          updatedAt: typeof freshDeck.updatedAt === 'string' ? new Date(freshDeck.updatedAt) : freshDeck.updatedAt ?? new Date(),
        });
      } else {
        setEditingDeck(null);
      }
      loadAllFiles();
      toast({ title: 'Deck updated!', description: `"${updatedDeckData.title}" saved.` });
    } catch (err: any) {
      console.error('Error saving edited deck:', err);
      toast({ title: 'Failed to save', description: err?.message || 'Something went wrong.', variant: 'destructive' });
    }
  }, [user?.uid, toast]);

  return (
    <>
      {/* Full-screen flashcard editor overlay */}
      {editingDeck && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
          <FlashcardCreator
            initialDeck={editingDeck}
            onClose={() => {
              setEditingDeck(null);
              // Re-open the viewer if we were viewing
              if (viewingDeck) {
                // viewingDeck is still set, so the viewer will render
              }
            }}
            onSave={handleEditDeckSave}
          />
        </div>
      )}

      {/* Full-screen flashcard viewer overlay */}
      {viewingDeck && !editingDeck && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
          <FlashcardViewer
            deck={viewingDeck}
            onClose={() => {
              setViewingDeck(null);
              loadAllFiles();
            }}
            onEdit={() => {
              setEditingDeck(viewingDeck);
            }}
          />
        </div>
      )}

      <div className="h-screen flex">
        {/* Left Sidebar - File Tree */}
        <div className="w-64 border-r bg-background flex-shrink-0">
          <FileTree
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItem?.id}
          />
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>

      {/* Create Dialog */}
      <CreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateNote={createNewNote}
        onCreateFolder={createNewFolder}
        onFilesChanged={loadAllFiles}
      />
    </>
  );
};

export default FilesPage;
