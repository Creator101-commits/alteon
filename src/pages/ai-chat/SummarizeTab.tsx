/**
 * SummarizeTab — Input panel + results panel for the Summarize feature tab.
 */
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormattedMessage } from "@/components/ui/FormattedMessage";
import {
  Zap,
  FileCheck,
  List,
  FileText,
  Upload,
  Loader2,
  Copy,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
} from "lucide-react";
import type { ChatMessage, SummaryType } from "./types";

interface SummarizeTabProps {
  summaryType: SummaryType;
  setSummaryType: (v: SummaryType) => void;
  inputText: string;
  setInputText: (v: string) => void;
  isLoading: boolean;
  processingStatus: string | null;
  notes: any[];
  selectedNote: any | null;
  setSelectedNote: (v: any | null) => void;
  showNoteSelector: boolean;
  setShowNoteSelector: (v: boolean) => void;
  messages: ChatMessage[];
  fileInputRef: React.RefObject<HTMLInputElement>;
  messagesEndRef: React.Ref<HTMLDivElement>;
  handleTextSummarize: () => void;
  handleNoteSummarize: () => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loadNotes: () => void;
  copyToClipboard: (text: string) => void;
  getSummaryTypeIcon: (type: SummaryType) => React.ReactNode;
  getSummaryTypeColor: (type: SummaryType) => string;
}

export function SummarizeTab({
  summaryType,
  setSummaryType,
  inputText,
  setInputText,
  isLoading,
  processingStatus,
  notes,
  selectedNote,
  setSelectedNote,
  showNoteSelector,
  setShowNoteSelector,
  messages,
  fileInputRef,
  messagesEndRef,
  handleTextSummarize,
  handleNoteSummarize,
  handleFileUpload,
  loadNotes,
  copyToClipboard,
  getSummaryTypeIcon,
  getSummaryTypeColor,
}: SummarizeTabProps) {
  const summaryMessages = messages.filter((msg) => msg.summaryType);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-6 md:gap-8 min-h-full">
          {/* Input Panel */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">
            {/* Summary Settings Card */}
            <Card className="bg-card border-border backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-foreground">
                  Summary Settings
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose how you want your content summarized
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Summary Type</Label>
                  <Select
                    value={summaryType}
                    onValueChange={(v) => setSummaryType(v as SummaryType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick">
                        <div className="flex items-center space-x-2">
                          <Zap className="h-4 w-4" />
                          <span>Quick Summary</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="detailed">
                        <div className="flex items-center space-x-2">
                          <FileCheck className="h-4 w-4" />
                          <span>Detailed Breakdown</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="bullet">
                        <div className="flex items-center space-x-2">
                          <List className="h-4 w-4" />
                          <span>Bullet Notes</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Input Methods Card */}
            <Card className="border-0 shadow-none">
              <CardHeader>
                <CardTitle>Input Methods</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Text Input */}
                <div>
                  <Label>Direct Text Input</Label>
                  <Textarea
                    placeholder="Paste your text here to summarize..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={handleTextSummarize}
                    disabled={isLoading || !inputText.trim()}
                    className="w-full mt-2"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Summarize Text
                  </Button>
                </div>

                {/* Notes Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Select from Your Notes</Label>
                    <Button
                      onClick={loadNotes}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={isLoading}
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={() =>
                        setShowNoteSelector(!showNoteSelector)
                      }
                      variant="outline"
                      className="w-full justify-between"
                      disabled={isLoading}
                    >
                      <div className="flex items-center">
                        <StickyNote className="h-4 w-4 mr-2" />
                        {selectedNote
                          ? selectedNote.title
                          : "Choose a note to summarize"}
                      </div>
                      {showNoteSelector ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>

                    {showNoteSelector && (
                      <NoteList
                        notes={notes}
                        selectedNote={selectedNote}
                        onSelect={(note) => {
                          setSelectedNote(note);
                          setShowNoteSelector(false);
                        }}
                      />
                    )}

                    {selectedNote && (
                      <Button
                        onClick={handleNoteSummarize}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <StickyNote className="h-4 w-4 mr-2" />
                        )}
                        Summarize Selected Note
                      </Button>
                    )}
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <Label>File Upload</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.pptx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document (PDF/PPTX/TXT)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle>Summarization Results</CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI-generated summaries will appear here
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 pr-4 overflow-y-auto">
                  <div className="space-y-4">
                    {summaryMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>
                          Upload a document, paste text, or share a YouTube
                          link to get started
                        </p>
                      </div>
                    ) : (
                      summaryMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[90%] p-4 rounded-lg ${
                              message.type === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted border border-border"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {message.type === "user" ? (
                                  <p className="text-sm whitespace-pre-wrap">
                                    {message.content}
                                  </p>
                                ) : (
                                  <FormattedMessage
                                    content={message.content}
                                    animated={true}
                                    animationSpeed={4}
                                  />
                                )}
                                {message.summaryType &&
                                  message.type === "assistant" && (
                                    <Badge
                                      className={`mt-3 ${getSummaryTypeColor(message.summaryType)}`}
                                    >
                                      {getSummaryTypeIcon(
                                        message.summaryType
                                      )}
                                      <span className="ml-1 capitalize">
                                        {message.summaryType}
                                      </span>
                                    </Badge>
                                  )}
                              </div>
                              {message.type === "assistant" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 ml-2 flex-shrink-0"
                                  onClick={() =>
                                    copyToClipboard(message.content)
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && (
                      <div className="flex justify-center py-8">
                        <div className="bg-card border border-border rounded-xl p-6 shadow-lg max-w-sm w-full">
                          <div className="flex flex-col items-center gap-4">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                            </div>
                            <div className="text-center">
                              <p className="font-medium text-foreground">
                                {processingStatus || "Processing..."}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This may take a moment
                              </p>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full animate-pulse"
                                style={{ width: "60%" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Note selection dropdown list */
function NoteList({
  notes,
  selectedNote,
  onSelect,
}: {
  notes: any[];
  selectedNote: any | null;
  onSelect: (note: any) => void;
}) {
  const stripHtmlTags = (html: string) => html.replace(/<[^>]+>/g, "");

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 max-h-60 overflow-y-auto">
      {notes.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No notes found</p>
          <p className="text-xs">
            Create some notes first to summarize them here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const preview = stripHtmlTags(note.content).slice(0, 100);
            return (
              <div
                key={note.id}
                className={`p-3 rounded-md border cursor-pointer transition-all hover:bg-accent/50 ${
                  selectedNote?.id === note.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                }`}
                onClick={() => onSelect(note)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {note.title || "Untitled Note"}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {preview}...
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {note.category && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0"
                        >
                          {note.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(
                          note.updatedAt || note.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {selectedNote?.id === note.id && (
                    <Eye className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
