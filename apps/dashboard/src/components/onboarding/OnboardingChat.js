import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Stack,
  Paper,
  InputAdornment,
  Chip,
  Tooltip,
  CircularProgress,
  Card,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PaperPlaneTilt,
  Robot,
  User,
  Copy,
  Warning,
  CheckCircle,
  XCircle,
  X,
  Code,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import CodeRenderer from './CodeRenderer';
import docsService from '../../services/docsService';
import { useGetUserQuery } from '@/services/auth/authService';

const OnboardingChat = ({ 
  mode = 'assistant', // 'assistant' or 'agent-setup'
  onComplete,
  isDarkMode = false,
  position = 'center', // Default to center
  visible = false,
  onClose,
  questions = []
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(visible);
  const [sessionId, setSessionId] = useState(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalContent, setCodeModalContent] = useState('');
  const [guideContent, setGuideContent] = useState(''); // Store guide content for banner
  const [chatHeight, setChatHeight] = useState(200); // Track chat height
  const router = useRouter();
  const messagesEndRef = useRef(null);
  const { data: userData, error, isLoading: isUserLoading } = useGetUserQuery();

  const handleClose = () => {
    setIsVisible(false);
    // Reset chat messages to start fresh next time
    setMessages([]);
    // Reset other chat state
    setSessionId(null);
    setGuideContent('');
    setInputValue('');
    // Emit event to restore onboarding elements
    window.dispatchEvent(new CustomEvent('onboarding:chat-closed'));
    onClose?.();
  };

  const theme = {
    bgcolor: '#333333',
    color: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    messageBg: '#000000', // User messages - black
    aiMessageBg: 'rgba(255, 255, 255, 0.1)', // Agent messages - light grey
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // Recalculate height when messages change
    const newHeight = calculateHeight();
    setChatHeight(newHeight);
  }, [messages]);

  useEffect(() => {
    // Recalculate height when loading state changes
    const newHeight = calculateHeight();
    setChatHeight(newHeight);
  }, [isLoading]);

  useEffect(() => {
    setIsVisible(visible);
    
    // Recalculate height when visibility changes
    if (visible) {
      const newHeight = calculateHeight();
      setChatHeight(newHeight);
      window.dispatchEvent(new CustomEvent('onboarding:chat-opened'));
    } else {
      window.dispatchEvent(new CustomEvent('onboarding:chat-closed'));
    }
  }, [visible]);

  useEffect(() => {
    // Only add initial greeting if no messages exist
    if (messages.length === 0) {
      setTimeout(() => {
        const newHeight = calculateHeight();
        setChatHeight(newHeight);
      }, 100);
    }
  }, []);

  useEffect(() => {
    const handleOpenChat = async (event) => {
      if (event.detail.mode === mode && event.detail.message) {
        // Add the user's message
        const userMessage = {
          id: Date.now() + Math.random(),
          sender: 'user',
          content: event.detail.message,
          type: 'text',
          metadata: {},
          timestamp: new Date()
        };
        setMessages([userMessage]);
        
        // Call AI agent with the message
        setIsLoading(true);
        
        // Emit loading state change event to prevent banner re-renders
        window.dispatchEvent(new CustomEvent('onboarding:loading-state-change', {
          detail: { loading: true }
        }));
        
        try {
          const aiResponse = await callAIAgent(event.detail.message);
          const processedResponse = processAIResponse(aiResponse);
          
          addMessage('ai', processedResponse.content, processedResponse.type, processedResponse.metadata, true); // From backend
        } catch (error) {
          addMessage('ai', "I'm sorry, I encountered an error. Please try again or check your connection.", 'text', {}, false); // Not from backend
        } finally {
          setIsLoading(false);
          
          // Emit loading state change event to allow banner updates
          window.dispatchEvent(new CustomEvent('onboarding:loading-state-change', {
            detail: { loading: false }
          }));
        }
      }
    };

    const handleCloseChat = () => {
      handleClose();
    };

    window.addEventListener('openOnboardingChat', handleOpenChat);
    window.addEventListener('onboarding:close-chat', handleCloseChat);
    return () => {
      window.removeEventListener('openOnboardingChat', handleOpenChat);
      window.removeEventListener('onboarding:close-chat', handleCloseChat);
    };
  }, [mode, sessionId, handleClose]);

  const addMessage = (sender, content, type = 'text', metadata = {}, fromBackend = false) => {
    // If this is an AI message with onboarding flag, store content for guide and don't display it
    if (sender === 'ai' && metadata.showOnboardingGuide) {
      setGuideContent(content);
      
      // Only add the default guide intro message
      setTimeout(() => {
        const guideMessageId = Date.now() + Math.random();
        const guideMessage = {
          id: guideMessageId,
          sender: 'ai',
          content: "Let me walk you through the process of creating your agent. This guide will show you step-by-step how to set up monitoring, connect your agent, and configure evaluations.",
          type: 'text',
          metadata: { isGuideIntro: true, showOnboardingGuide: true },
          timestamp: new Date(),
          fromBackend: false
        };
        setMessages(prev => [...prev, guideMessage]);
      }, 300);
      return; // Don't add the original message
    }

    const messageId = Date.now() + Math.random();
    const message = {
      id: messageId,
      sender,
      content,
      type,
      metadata,
      timestamp: new Date(),
      fromBackend // Track if message came from backend
    };
    
    setMessages(prev => [...prev, message]);
  };

  // Calculate dynamic height based on message count and content
  const calculateHeight = () => {
    const inputHeight = 80; // Input area height (increased for padding)
    const baseMessageHeight = 60; // Base height per message (more realistic)
    const extraPadding = 40; // Extra padding for container margins
    const minContentHeight = 120; // Minimum content area
    
    // Calculate estimated content height based on message count and content length
    let estimatedContentHeight = minContentHeight;
    
    if (messages.length > 0 || isLoading) {
      // More sophisticated height calculation
      const totalMessages = messages.length;
      
      if (totalMessages > 0) {
        // Base height calculation with consideration for content length
        const avgContentLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / messages.length;
        const heightMultiplier = Math.max(1, Math.min(2, avgContentLength / 100)); // Scale based on content length
        
        estimatedContentHeight = totalMessages * baseMessageHeight * heightMultiplier;
      } else if (isLoading) {
        // If only loading (no messages yet), use a smaller height
        estimatedContentHeight = minContentHeight;
      }
    }
    
    const totalHeight = estimatedContentHeight + inputHeight + extraPadding;
    const maxHeight = Math.min(window.innerHeight * 0.8, 600); // Slightly increased max height
    const minHeight = 100; // Minimum height to prevent too small chat
    
    return Math.max(minHeight, Math.min(totalHeight, maxHeight));
  };

  // Calculate dynamic width based on screen size
  const calculateWidth = () => {
    const maxWidth = Math.min(window.innerWidth * 0.9, 550); // Increased max width to 550px
    const minWidth = 380; // Increased minimum width
    return Math.max(minWidth, maxWidth);
  };

  const processAIResponse = (response) => {
    if (!response.answer) {
      return {
        content: "I'm sorry, I didn't receive a proper response. Please try again.",
        type: 'text',
        metadata: {}
      };
    }

    // Check if response contains code blocks
    const codeBlockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;
    
    while ((match = codeBlockRegex.exec(response.answer)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    // Check for onBoarding flag
    const hasOnboardingFlag = response.on_boarding_observability_finished === true;
    const hasEvaluatorsFlag = response.evaluators_added === true;
    const customEvaluatorsFlag = response.custom_evaluator_management === true;
    const optimizationCompletedFlag = response.flags?.optimization_completed === true;
    
    // Emit event when evaluators are detected - let OnboardingOrchestrator handle the logic
    if (hasEvaluatorsFlag) {
      window.dispatchEvent(new CustomEvent('onboarding:evaluators-detected'));
    }

    // Emit event when optimization is completed
    if (optimizationCompletedFlag) {
      console.log('optimizationCompletedFlag', optimizationCompletedFlag);
      window.dispatchEvent(new CustomEvent('optimizationCompleted', {
        detail: { flags: response.flags }
      }));
      handleClose();
    }

    if (customEvaluatorsFlag) {
      // close chat
      handleClose();
    }
    
    if (codeBlocks.length > 0) {
      return {
        content: response.answer,
        type: 'markdown-with-code',
        metadata: { 
          codeBlocks,
          showOnboardingGuide: hasOnboardingFlag
        }
      };
    }

    return {
      content: response.answer,
      type: 'text',
      metadata: {
        showOnboardingGuide: hasOnboardingFlag,
      }
    };
  };

  const callAIAgent = async (question) => {
    try {
      const aiApiUrl = process.env.NEXT_PUBLIC_AI_AGENT_URL || 'http://localhost:3006/api/ai/chat';
      
      // Get the authorization token from localStorage
      const token = localStorage.getItem('custom-auth-token');

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
 
      
      const response = await fetch(aiApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question,
          sessionId: sessionId || undefined,
          handitToken: userData?.company?.apiToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Store sessionId from first response
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      return data;
    } catch (error) {
      console.error('Error calling AI agent:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);

    setIsLoading(true);
    
    // Emit loading state change event to prevent banner re-renders
    window.dispatchEvent(new CustomEvent('onboarding:loading-state-change', {
      detail: { loading: true }
    }));
    
    try {
      const aiResponse = await callAIAgent(userMessage);
      const processedResponse = processAIResponse(aiResponse);
      
      addMessage('ai', processedResponse.content, processedResponse.type, processedResponse.metadata, true); // From backend
    } catch (error) {
      addMessage('ai', "I'm sorry, I encountered an error. Please try again or check your connection.", 'text', {}, false); // Not from backend
    } finally {
      setIsLoading(false);
      
      // Emit loading state change event to allow banner updates
      window.dispatchEvent(new CustomEvent('onboarding:loading-state-change', {
        detail: { loading: false }
      }));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const openCodeModal = (code) => {
    setCodeModalContent(code);
    setCodeModalOpen(true);
  };


  const renderMarkdownWithCode = (content, codeBlocks) => {
    if (!codeBlocks || codeBlocks.length === 0) {
      return (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Typography>
      );
    }

    let processedContent = content;
    const elements = [];
    let lastIndex = 0;

    // Replace code blocks with placeholders and collect them
    codeBlocks.forEach((block, index) => {
      const codeBlockRegex = new RegExp(`\`\`\`${block.language}?\\s*\\n[\\s\\S]*?\`\`\``, 'g');
      const match = codeBlockRegex.exec(processedContent);
      
      if (match) {
        // Add text before the code block
        if (match.index > lastIndex) {
          const textBefore = processedContent.substring(lastIndex, match.index);
          if (textBefore.trim()) {
            elements.push(
              <Typography key={`text-${index}`} variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                {textBefore}
              </Typography>
            );
          }
        }

        // Add the code block
        elements.push(
          <Box key={`code-${index}`} sx={{ position: 'relative', mb: 2 }}>
            <Box
              sx={{
                maxHeight: '200px',
                overflow: 'auto',
                borderRadius: 1,
                '& pre': {
                  margin: '0 !important',
                }
              }}
            >
              <CodeRenderer
                code={block.code}
                language={block.language}
                showLineNumbers={false}
              />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 1
              }}
            >
              <Tooltip title="Copy code">
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(block.code)}
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.5)'
                    }
                  }}
                >
                  <Copy size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open in modal">
                <IconButton
                  size="small"
                  onClick={() => openCodeModal(block.code)}
                  sx={{
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.5)'
                    }
                  }}
                >
                  <Code size={14} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        );

        lastIndex = match.index + match[0].length;
      }
    });

    // Add any remaining text
    if (lastIndex < processedContent.length) {
      const remainingText = processedContent.substring(lastIndex);
      if (remainingText.trim()) {
        elements.push(
          <Typography key="text-final" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {remainingText}
          </Typography>
        );
      }
    }

    return <Box>{elements}</Box>;
  };

  // Component for rendering AI messages (no animation)
  const AIMessage = ({ message }) => {
    return (
      <Box>
        <Paper
          sx={{
            px: 1.5, // Reduced padding
            py: 1, // Reduced padding
            maxWidth: '85%', // Increased max width since no avatars
            bgcolor: theme.aiMessageBg,
            borderRadius: '16px 16px 16px 6px', // Reduced border radius
            color: theme.color,
            wordBreak: 'break-word'
          }}
        >
          {(message.type === 'instruction' || message.type === 'code') && message.metadata.code ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, fontSize: '0.8rem' }}>
                {message.content}
              </Typography>
              <Box
                sx={{
                  position: 'relative',
                  maxHeight: '200px',
                  overflow: 'auto',
                  borderRadius: 1,
                  '& pre': {
                    margin: '0 !important',
                  }
                }}
              >
                <CodeRenderer
                  code={message.metadata.code}
                  language={message.metadata.language || 'javascript'}
                  showLineNumbers={false}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'flex',
                    gap: 1
                  }}
                >
                  <Tooltip title="Copy code">
                    <IconButton
                      size="small"
                      onClick={() => copyToClipboard(message.metadata.code)}
                      sx={{
                        bgcolor: 'rgba(0, 0, 0, 0.3)',
                        color: 'white',
                        width: 20,
                        height: 20,
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.5)'
                        }
                      }}
                    >
                      <Copy size={12} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open in modal">
                    <IconButton
                      size="small"
                      onClick={() => openCodeModal(message.metadata.code)}
                      sx={{
                        bgcolor: 'rgba(0, 0, 0, 0.3)',
                        color: 'white',
                        width: 20,
                        height: 20,
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.5)'
                        }
                      }}
                    >
                      <Code size={12} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>
          ) : message.type === 'markdown-with-code' && message.metadata.codeBlocks ? (
            <Box>
              {renderMarkdownWithCode(message.content, message.metadata.codeBlocks)}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
              {message.content}
            </Typography>
          )}
        </Paper>
        
        {/* Show onboarding guide button if flag is set */}
        {message.metadata.showOnboardingGuide && (
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                // Save the generated documentation
                if (guideContent) {
                  docsService.saveGeneratedDocs(guideContent);
                }
                
                // Navigate to docs page
                router.push('/docs');
                
                // Close chat
                handleClose();
              }}
              sx={{
                bgcolor: 'var(--mui-palette-secondary-main)',
                color: 'black',
                textTransform: 'none',
                fontSize: '0.75rem',
                px: 2,
                py: 0.5,
                '&:hover': {
                  bgcolor: 'var(--mui-palette-primary-main)'
                }
              }}
            >
              Show me the guide
            </Button>
          </Box>
        )}
        {message.metadata.showCloseChat && (
          <Box sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                // Close chat
                handleClose();
              }}
              sx={{
                bgcolor: 'var(--mui-palette-secondary-main)',
                color: 'black',
                textTransform: 'none',
                fontSize: '0.75rem',
                px: 2,
                py: 0.5,
                '&:hover': {
                  bgcolor: 'var(--mui-palette-primary-main)'
                }
              }}
            >
              Close chat
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  const renderMessage = (message) => {
    const isAi = message.sender === 'ai';
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isAi ? 'flex-start' : 'flex-end',
          mb: 0.5, // Reduced margin
        }}
      >
        {isAi ? (
          <AIMessage message={message} />
        ) : (
          <Paper
            sx={{
              px: 1.5, // Reduced padding
              py: 1, // Reduced padding
              maxWidth: '85%', // Increased max width since no avatars
              bgcolor: theme.messageBg,
              borderRadius: '16px 16px 6px 16px', // Reduced border radius
              color: theme.color,
              wordBreak: 'break-word'
            }}
          >
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
              {message.content}
            </Typography>
          </Paper>
        )}
      </Box>
    );
  };

  const getPositionStyles = () => {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  };


  if (!isVisible) return null;

  return (
    <>
      {/* Full-screen backdrop with blur effect */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.3)', // Semi-transparent overlay
          backdropFilter: 'blur(8px)', // Blur the entire background
          WebkitBackdropFilter: 'blur(8px)', // Safari support
        }}
        onClick={handleClose}
      />
      
      <Box
        sx={{
          position: 'fixed',
          zIndex: 10000,
          ...getPositionStyles(),
          width: calculateWidth(),
          height: chatHeight,
          borderRadius: '8px', // Reduced border radius
          // Add subtle animation for floating appearance
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)', // Removed backdrop filter from here
          animation: 'floatIn 0.3s ease-out',
          '@keyframes floatIn': {
            '0%': {
              opacity: 0,
              transform: 'translate(-50%, -50%) scale(0.95)',
            },
            '100%': {
              opacity: 1,
              transform: 'translate(-50%, -50%) scale(1)',
            },
          },
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.bgcolor,
            borderRadius: '8px', // Reduced border radius
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Chat Messages */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              px: 1.5, // Reduced padding
              py: 1.5, // Increased top padding to compensate for no header
              minHeight: 0, // Important for flex child to be scrollable
              // Hide scrollbar while keeping scroll functionality
              '&::-webkit-scrollbar': {
                display: 'none',
              },
              '-ms-overflow-style': 'none', // IE and Edge
              'scrollbar-width': 'none', // Firefox
            }}
          >
            {messages.map(renderMessage)}
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 0.5 }}>
                <Paper
                  sx={{
                    px: 1.5,
                    py: 1, // Reduced padding
                    bgcolor: theme.aiMessageBg, // Updated to match agent messages
                    borderRadius: '16px 16px 16px 6px', // Reduced border radius
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}
                >
                  <CircularProgress size={12} />
                  <Typography variant="body2" sx={{ color: theme.color, fontSize: '0.8rem' }}>
                    Thinking...
                  </Typography>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Chat Input */}
          <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything..."
                variant="outlined"
                size="small"
                disabled={isLoading}
                autoComplete="off"
                inputProps={{
                  autoComplete: "off",
                  autoCorrect: "off",
                  autoCapitalize: "off",
                  spellCheck: "false"
                }}
                sx={{
                  borderRadius: 1.5,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: theme.inputBg,
                    borderRadius: 1.5,
                    minHeight: '36px', // Reduced height
                    '& fieldset': { borderColor: theme.borderColor },
                    '&:hover fieldset': { borderColor: theme.borderColor },
                    '&.Mui-focused fieldset': { borderColor: '#4A90E2' },
                  },
                  '& .MuiOutlinedInput-input': {
                    color: theme.color,
                    fontSize: '0.8rem', // Reduced font size
                    py: 0.5, // Reduced padding
                    '&::placeholder': {
                      color: 'rgba(255, 255, 255, 0.5)',
                      opacity: 1
                    }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="submit"
                        size="small"
                        disabled={!inputValue.trim() || isLoading}
                        sx={{
                          color: theme.borderColor,
                          width: 24,
                          height: 24,
                          '&:hover': {
                            bgcolor: 'rgba(74, 144, 226, 0.1)'
                          }
                        }}
                      >
                        <PaperPlaneTilt size={12} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </form>
          </Box>
        </Card>

        {/* Code Modal */}
        <Dialog
          open={codeModalOpen}
          onClose={() => setCodeModalOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: theme.bgcolor,
              color: theme.color,
              minHeight: '30vh',
              height: 'auto',
              maxHeight: '50vh',
              zIndex: 50000
            }
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `1px solid ${theme.borderColor}`,
              color: theme.color
            }}
          >
            <Typography variant="h6">Code Preview</Typography>
            <IconButton
              onClick={() => setCodeModalOpen(false)}
              sx={{ color: theme.color }}
            >
              <X size={20} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box
              sx={{
                position: 'relative',
                minHeight: '400px',
                overflow: 'auto',
                '& pre': {
                  margin: '0 !important',
                  minHeight: '400px'
                }
              }}
            >
              <CodeRenderer
                code={codeModalContent}
                language="javascript"
                showLineNumbers={true}
              />
              <Tooltip title="Copy code">
                <IconButton
                  onClick={() => copyToClipboard(codeModalContent)}
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.5)'
                    }
                  }}
                >
                  <Copy size={16} />
                </IconButton>
              </Tooltip>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </>
  );
};

export default OnboardingChat; 