import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
// Import required CSS
import 'katex/dist/katex.min.css';

// Mermaid is loaded on demand — do NOT import it at the module level.
// (It is ~1 MB and only needed when an AI response contains a diagram.)

interface FormattedMessageProps {
  content: string;
  className?: string;
  animated?: boolean;
  animationSpeed?: number;
  onAnimationComplete?: () => void;
}

// Store completed animations to prevent re-animation
const completedAnimations = new Set<string>();

// Typing animation hook
function useTypingAnimation(text: string, speed: number = 4, skipAnimation: boolean = false) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!text) return;
    
    // If we should skip animation, show all text immediately
    if (skipAnimation) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }
    
    // Reset state when text changes
    setDisplayedText("");
    setIsComplete(false);
    indexRef.current = 0;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start typing animation
    intervalRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        setIsComplete(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, speed, skipAnimation]);

  return { displayedText, isComplete };
}

// Copy to clipboard utility
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch (err) {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

// Enhanced Code Block Component with Copy Button
const CodeBlock: React.FC<{ 
  children: string; 
  className?: string; 
  language?: string;
}> = ({ children, className, language }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const success = await copyToClipboard(children);
    if (success) {
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "Failed",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  // Syntax highlighting removed to fix errors

  return (
    <div className="relative group my-4 overflow-hidden rounded-lg border border-border">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 text-xs font-mono border-b border-gray-700">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          {language && <span className="ml-2 text-gray-400">{language}</span>}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      
      {/* Code content */}
      <pre className={`bg-gray-900 dark:bg-gray-900 text-gray-100 p-4 overflow-x-auto font-mono text-sm ${className || ''}`}>
        <code className="text-gray-100">
          {children}
        </code>
      </pre>
    </div>
  );
};

// Mermaid Diagram Component - Renders actual diagrams
const MermaidDiagram: React.FC<{ content: string }> = ({ content }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const renderDiagram = async () => {
      if (!elementRef.current || !content) return;

      try {
        // Dynamically load mermaid only when a diagram is actually rendered
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'monospace',
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.render(id, content.trim());
        setSvg(renderedSvg);
        setError('');
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [content]);

  if (error) {
    return (
      <div className="my-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <p className="text-sm text-destructive font-semibold mb-2"> Mermaid Diagram Error:</p>
        <pre className="text-xs text-destructive/80 p-3 rounded overflow-x-auto font-mono">
          {error}
        </pre>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show diagram code</summary>
          <pre className="text-xs bg-background/50 p-3 rounded overflow-x-auto font-mono mt-2">
            {content}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div 
      ref={elementRef}
      className="my-4 p-4 bg-muted/50 border border-border rounded-lg overflow-x-auto"
    >
      {svg ? (
        <div 
          dangerouslySetInnerHTML={{ __html: svg }}
          className="flex justify-center items-center"
        />
      ) : (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-sm text-muted-foreground">Rendering diagram...</span>
        </div>
      )}
    </div>
  );
};

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ 
  content, 
  className = "",
  animated = false,
  animationSpeed = 4,
  onAnimationComplete
}) => {
  const [isInstantComplete, setIsInstantComplete] = useState(false);
  
  // Check if this content was already animated
  useEffect(() => {
    if (completedAnimations.has(content)) {
      setIsInstantComplete(true);
    } else {
      setIsInstantComplete(false);
    }
  }, [content]);

  const { displayedText, isComplete } = useTypingAnimation(
    content,
    animationSpeed,
    !animated || isInstantComplete
  );

  // Mark animation as complete and store in memory
  useEffect(() => {
    if (isComplete && animated && !isInstantComplete) {
      completedAnimations.add(content);
      onAnimationComplete?.();
    }
  }, [isComplete, animated, isInstantComplete, content, onAnimationComplete]);

  // Use the appropriate text based on animation state
  const textToRender = animated && !isInstantComplete ? displayedText : content;
  const showCursor = animated && !isComplete && !isInstantComplete;

  // Extract Mermaid diagrams before processing
  const mermaidDiagrams: { [key: string]: string } = {};
  let mermaidCounter = 0;
  
  const processedContent = textToRender.replace(
    /```mermaid\n([\s\S]*?)\n```/g,
    (match, diagramContent) => {
      const placeholder = `MERMAIDPLACEHOLDER${mermaidCounter}ENDPLACEHOLDER`;
      mermaidDiagrams[placeholder] = diagramContent;
      mermaidCounter++;
      return placeholder;
    }
  );

  return (
    <div className={`formatted-response prose prose-sm max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom styling for different elements
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground border-b border-border pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mb-3 mt-4 first:mt-0 text-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-foreground">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-xs font-semibold mb-2 mt-3 first:mt-0 text-foreground opacity-80">
              {children}
            </h6>
          ),
          p: ({ children }) => {
            // Check if this paragraph contains a Mermaid placeholder
            let textContent = '';
            
            // Extract text from various possible child structures
            if (typeof children === 'string') {
              textContent = children;
            } else if (Array.isArray(children)) {
              // Flatten and extract text from all children
              textContent = children.map(child => {
                if (typeof child === 'string') return child;
                if (React.isValidElement(child)) {
                  const props = child.props as { children?: any };
                  if (props.children) {
                    return String(props.children);
                  }
                }
                return '';
              }).join('');
            } else if (React.isValidElement(children)) {
              const props = children.props as { children?: any };
              if (props.children) {
                textContent = String(props.children);
              }
            }
            
            // Check if we have a Mermaid placeholder
            const placeholderMatch = textContent.match(/MERMAIDPLACEHOLDER(\d+)ENDPLACEHOLDER/);
            if (placeholderMatch) {
              const placeholder = placeholderMatch[0];
              if (mermaidDiagrams[placeholder]) {
                return <MermaidDiagram content={mermaidDiagrams[placeholder]} />;
              }
            }
            
            return (
              <p className="text-foreground leading-relaxed mb-4 last:mb-0">
                {children}
              </p>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            
            if (isInline) {
              return (
                <code 
                  className="bg-muted px-2 py-1 rounded text-sm font-mono text-foreground border"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // For code blocks in pre tags
            return (
              <code className="text-gray-100" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            // Extract code content safely
            let codeContent = '';
            let language = '';
            
            try {
              const codeElement = React.Children.toArray(children)[0] as React.ReactElement;
              if (codeElement && codeElement.props) {
                language = codeElement.props.className?.replace('language-', '') || '';
                codeContent = String(codeElement.props.children || '');
              } else {
                codeContent = String(children || '');
              }
            } catch (error) {
              codeContent = String(children || '');
            }
            
            return <CodeBlock language={language}>{codeContent}</CodeBlock>;
          },
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 py-3 italic">
              <div className="text-blue-800 dark:text-blue-200">
                {children}
              </div>
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc list-inside space-y-2 text-foreground">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal list-inside space-y-2 text-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              <span className="ml-2">{children}</span>
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:underline break-words"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/50">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-6 border-t border-border" />
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-lg my-4"
            />
          ),
          // Task list items (GitHub flavored markdown)
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 mt-1 flex-shrink-0"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
      {showCursor && (
        <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5 opacity-75"></span>
      )}
    </div>
  );
};

export default FormattedMessage;