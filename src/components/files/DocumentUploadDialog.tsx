import React, { useState, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/supabase-storage';
import { GroqAPI } from '@/lib/groq';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
} from 'lucide-react';

type Mode = 'notes' | 'flashcards';

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  onComplete?: () => void;
}

interface ProcessingState {
  phase: 'idle' | 'uploading' | 'processing' | 'generating' | 'complete' | 'error';
  message: string;
  progress?: number;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  mode,
  onComplete,
}: DocumentUploadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [processingState, setProcessingState] = useState<ProcessingState>({
    phase: 'idle',
    message: 'Select a file to get started',
  });
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [title, setTitle] = useState('');

  const resetState = () => {
    setSelectedFile(null);
    setDocumentContent('');
    setProcessingState({ phase: 'idle', message: 'Select a file to get started' });
    setGeneratedContent('');
    setTitle('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, PPTX, or TXT file',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
    setProcessingState({ phase: 'idle', message: 'Click "Process Document" to continue' });
  };

  const processDocument = async () => {
    if (!selectedFile || !user?.uid) return;

    try {
      // Handle text files directly
      if (selectedFile.type === 'text/plain') {
        setProcessingState({ phase: 'processing', message: 'Reading text file...' });
        const content = await selectedFile.text();
        setDocumentContent(content);
        await generateContent(content);
        return;
      }

      // Upload and process PDF/PPTX
      setProcessingState({ phase: 'uploading', message: 'Uploading document...' });

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/document-intel/sessions', {
        method: 'POST',
        headers: {
          'x-user-id': user.uid,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const data = await response.json();
      const jobId = data.jobId;

      setProcessingState({ phase: 'processing', message: 'Extracting content...', progress: 0 });

      // Poll for content
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        setProcessingState({
          phase: 'processing',
          message: 'Extracting content...',
          progress: Math.round((attempts / maxAttempts) * 100),
        });

        try {
          const contentResponse = await fetch(`/api/document-intel/sessions/${jobId}/content`, {
            headers: {
              'x-user-id': user.uid,
            },
          });

          if (contentResponse.ok) {
            const contentData = await contentResponse.json();
            setDocumentContent(contentData.content);
            await generateContent(contentData.content);
            return;
          }
        } catch (error) {
          console.log('Still processing...');
        }
      }

      throw new Error('Document processing timeout');
    } catch (error: any) {
      console.error('Document processing error:', error);
      setProcessingState({
        phase: 'error',
        message: error.message || 'Failed to process document',
      });
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process document',
        variant: 'destructive',
      });
    }
  };

  const generateContent = async (content: string) => {
    if (!user?.uid) return;

    setProcessingState({ phase: 'generating', message: `Generating ${mode === 'notes' ? 'notes' : 'flashcards'}...` });

    try {
      const groq = new GroqAPI();

      if (mode === 'notes') {
        // Generate comprehensive notes from the content
        const response = await groq.chat({
          messages: [
            {
              role: 'system',
              content: `You are an expert note-taker and study assistant. Create comprehensive, well-organized study notes from the provided content. Use clear headings, bullet points, and highlight key concepts. Format the notes in a way that's easy to review and study from. Use markdown formatting.`,
            },
            {
              role: 'user',
              content: `Create detailed study notes from this content:\n\n${content.substring(0, 15000)}`,
            },
          ],
          maxTokens: 4000,
        });

        setGeneratedContent(response.content);
        setProcessingState({ phase: 'complete', message: 'Notes generated successfully!' });
      } else {
        // Generate flashcards using chat
        const response = await groq.chat({
          messages: [
            {
              role: 'system',
              content: `You are an expert flashcard creator. Create educational flashcards from the provided content. Generate 15-20 flashcards that cover the key concepts, facts, and important information. Format each flashcard exactly like this:

Q: [Question]
A: [Answer]

Make the questions clear and specific. Keep answers concise but complete. Include a mix of definition, concept, and application questions.`,
            },
            {
              role: 'user',
              content: `Create flashcards from this content:\n\n${content.substring(0, 15000)}`,
            },
          ],
          maxTokens: 4000,
        });

        setGeneratedContent(response.content);
        setProcessingState({ phase: 'complete', message: 'Flashcards generated successfully!' });
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      setProcessingState({
        phase: 'error',
        message: error.message || 'Failed to generate content',
      });
    }
  };

  const saveContent = async () => {
    if (!user?.uid || !generatedContent) return;

    try {
      if (mode === 'notes') {
        // Save as a new note
        await storage.createNote({
          userId: user.uid,
          title: title || 'AI Generated Notes',
          content: generatedContent,
          category: 'ai-generated',
        });

        toast({
          title: 'Success',
          description: 'Notes saved successfully!',
        });
      } else {
        // Flashcard creation - coming soon
        toast({
          title: 'Coming Soon',
          description: 'Flashcard generation is being redesigned. Please check back soon!',
        });
        return;
      }

      onComplete?.();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save content',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetState();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Create {mode === 'notes' ? 'Notes' : 'Flashcards'} from Document
          </DialogTitle>
          <DialogDescription>
            Upload a PDF, PPTX, or TXT file and AI will generate {mode === 'notes' ? 'study notes' : 'flashcards'} for you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Document</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx,.txt"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm">{selectedFile.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${mode === 'notes' ? 'note' : 'deck'} title...`}
            />
          </div>

          {/* Processing Status */}
          {processingState.phase !== 'idle' && (
            <div className={`p-4 rounded-lg border ${
              processingState.phase === 'error' ? 'bg-destructive/10 border-destructive' :
              processingState.phase === 'complete' ? 'bg-green-500/10 border-green-500' :
              'bg-primary/10 border-primary'
            }`}>
              <div className="flex items-center gap-2">
                {processingState.phase === 'error' ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : processingState.phase === 'complete' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
                <span className="text-sm font-medium">{processingState.message}</span>
                {processingState.progress !== undefined && processingState.phase === 'processing' && (
                  <span className="ml-auto text-xs text-muted-foreground">{processingState.progress}%</span>
                )}
              </div>
            </div>
          )}

          {/* Generated Content Preview */}
          {generatedContent && (
            <div className="space-y-2">
              <Label>Generated {mode === 'notes' ? 'Notes' : 'Flashcards'} Preview</Label>
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Generated content will appear here..."
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {processingState.phase === 'idle' && selectedFile && (
            <Button onClick={processDocument} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              Process Document
            </Button>
          )}
          
          {(processingState.phase === 'uploading' || processingState.phase === 'processing' || processingState.phase === 'generating') && (
            <Button disabled className="flex-1">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}
          
          {processingState.phase === 'complete' && generatedContent && (
            <Button onClick={saveContent} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Save {mode === 'notes' ? 'Notes' : 'Flashcards'}
            </Button>
          )}
          
          {processingState.phase === 'error' && (
            <Button onClick={processDocument} variant="destructive" className="flex-1">
              Try Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentUploadDialog;
