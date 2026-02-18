import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/supabase-storage';
import type { Folder, Note, FlashcardDeck } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  Brain,
  Layers,
  Plus,
  MoreHorizontal,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';

export type FileItem = {
  id: string;
  type: 'folder' | 'note' | 'flashcard-deck';
  name: string;
  parentId?: string | null;
  folderId?: string | null;
  color?: string;
  isPinned?: boolean;
  children?: FileItem[];
  // Flashcard deck metadata
  cardCount?: number;
  description?: string | null;
  tags?: string[];
  updatedAt?: Date | string | null;
};

interface FileTreeProps {
  onSelectItem: (item: FileItem) => void;
  selectedItemId?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ onSelectItem, selectedItemId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);

  // Drag-and-drop states
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'note' | 'flashcard-deck' } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadAllData();
    }
  }, [user?.uid]);

  const loadAllData = async () => {
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
      
      // Auto-expand folders that were previously expanded (stored in folder data)
      const expanded = new Set<string>(
        foldersData.filter((f: Folder) => f.isExpanded).map((f: Folder) => f.id)
      );
      setExpandedFolders(expanded);
    } catch (error) {
      console.error('Error loading file tree data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files and folders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFolder = async (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
    
    // Persist expansion state
    await storage.updateFolder(folderId, { isExpanded: newExpanded.has(folderId) });
  };

  const createFolder = async () => {
    if (!user?.uid || !newFolderName.trim()) return;
    
    try {
      const folder = await storage.createFolder({
        userId: user.uid,
        name: newFolderName.trim(),
        parentFolderId: parentFolderId,
      });
      
      setFolders(prev => [...prev, folder]);
      setNewFolderName('');
      setParentFolderId(null);
      setIsCreateFolderOpen(false);
      
      toast({
        title: 'Success',
        description: 'Folder created successfully',
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        variant: 'destructive',
      });
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? This will not delete the files inside.')) {
      return;
    }
    
    try {
      const success = await storage.deleteFolder(folderId);
      if (success) {
        setFolders(prev => prev.filter(f => f.id !== folderId));
        toast({
          title: 'Success',
          description: 'Folder deleted successfully',
        });
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete folder',
        variant: 'destructive',
      });
    }
  };

  const buildFileTree = (): FileItem[] => {
    const tree: FileItem[] = [];
    
    // Build folder tree
    const folderMap = new Map<string, FileItem>();
    
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        id: folder.id,
        type: 'folder',
        name: folder.name,
        parentId: folder.parentFolderId,
        color: folder.color || undefined,
        children: [],
      });
    });
    
    // Build hierarchy
    folderMap.forEach(folder => {
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(folder);
        }
      } else {
        tree.push(folder);
      }
    });
    
    // Add notes to folders or root
    notes.forEach(note => {
      const noteItem: FileItem = {
        id: note.id,
        type: 'note',
        name: note.title,
        folderId: note.folderId,
        isPinned: note.isPinned,
      };
      
      if (note.folderId) {
        const folder = folderMap.get(note.folderId);
        if (folder) {
          folder.children = folder.children || [];
          folder.children.push(noteItem);
        } else {
          tree.push(noteItem);
        }
      } else {
        tree.push(noteItem);
      }
    });

    // Add flashcard decks to folders or root
    flashcardDecks.forEach(deck => {
      const deckItem: FileItem = {
        id: deck.id,
        type: 'flashcard-deck',
        name: deck.title,
        folderId: deck.folderId,
        cardCount: deck.cardCount ?? 0,
        description: deck.description,
        tags: deck.tags ?? [],
        updatedAt: deck.updatedAt,
      };

      if (deck.folderId) {
        const folder = folderMap.get(deck.folderId);
        if (folder) {
          folder.children = folder.children || [];
          folder.children.push(deckItem);
        } else {
          tree.push(deckItem);
        }
      } else {
        tree.push(deckItem);
      }
    });
    
    return tree;
  };

  // Sidebar drag-and-drop handlers
  const handleSidebarDragStart = (e: React.DragEvent, id: string, type: 'note' | 'flashcard-deck') => {
    e.stopPropagation();
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
  };

  const handleSidebarDragEnd = () => {
    setDraggedItem(null);
    setDropTargetId(null);
    setRootDropActive(false);
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(folderId);
    setRootDropActive(false);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    if (!draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setRootDropActive(true);
    setDropTargetId(null);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setRootDropActive(false);
  };

  const handleDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    try {
      if (draggedItem.type === 'note') {
        await storage.updateNote(draggedItem.id, { folderId });
      } else if (draggedItem.type === 'flashcard-deck') {
        await storage.updateFlashcardDeck(draggedItem.id, { folderId });
      }
      toast({
        title: 'Success',
        description: folderId ? 'Moved to folder' : 'Moved to root',
      });
      await loadAllData();
    } catch (error) {
      console.error('Error moving item:', error);
      toast({
        title: 'Error',
        description: 'Failed to move item',
        variant: 'destructive',
      });
    } finally {
      setDraggedItem(null);
      setDropTargetId(null);
      setRootDropActive(false);
    }
  };

  const renderFileItem = (item: FileItem, depth = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = item.id === selectedItemId;
    
    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer group ${
            isSelected ? 'bg-accent' : ''
          } ${
            item.type === 'folder' && dropTargetId === item.id ? 'ring-2 ring-primary ring-offset-1' : ''
          } ${
            (item.type === 'note' || item.type === 'flashcard-deck') && draggedItem?.id === item.id ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          draggable={item.type === 'note' || item.type === 'flashcard-deck'}
          onDragStart={(e) => {
            if (item.type === 'note' || item.type === 'flashcard-deck') {
              handleSidebarDragStart(e, item.id, item.type);
            }
          }}
          onDragEnd={handleSidebarDragEnd}
          onDragOver={(e) => {
            if (item.type === 'folder' && draggedItem) {
              handleFolderDragOver(e, item.id);
            }
          }}
          onDragLeave={(e) => {
            if (item.type === 'folder') {
              handleFolderDragLeave(e);
            }
          }}
          onDrop={(e) => {
            if (item.type === 'folder' && draggedItem) {
              handleDrop(e, item.id);
            }
          }}
          onClick={() => {
            if (item.type === 'folder') {
              toggleFolder(item.id);
            } else {
              onSelectItem(item);
            }
          }}
        >
          {item.type === 'folder' && (
            <button
              className="p-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(item.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          
          {item.type === 'folder' && (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500" style={{ color: item.color }} />
            ) : (
              <FolderIcon className="h-4 w-4 text-blue-500" style={{ color: item.color }} />
            )
          )}
          
          {item.type === 'note' && (
            <FileText className="h-4 w-4 text-green-500" />
          )}
          
          {item.type === 'flashcard-deck' && (
            <Layers className="h-4 w-4 text-primary" />
          )}
          
          <span className="flex-1 text-sm truncate">{item.name}</span>
          
          {item.type === 'folder' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setParentFolderId(item.id);
                    setIsCreateFolderOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Subfolder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder(item.id);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {item.type === 'folder' && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderFileItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const fileTree = buildFileTree();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Files</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setParentFolderId(null);
              setIsCreateFolderOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-2 py-2">
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={(e) => handleDrop(e, null)}
          className={`min-h-full ${
            rootDropActive ? 'ring-2 ring-primary/50 ring-inset rounded-md bg-primary/5' : ''
          }`}
        >
        {fileTree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files or folders yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fileTree.map(item => renderFileItem(item))}
          </div>
        )}
        </div>
      </ScrollArea>
      
      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {parentFolderId ? 'Create Subfolder' : 'Create Folder'}
            </DialogTitle>
            <DialogDescription>
              Create a new folder to organize your notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createFolder();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  setNewFolderName('');
                  setParentFolderId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={createFolder} disabled={!newFolderName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileTree;
