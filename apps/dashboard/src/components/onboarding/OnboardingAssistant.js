import React, { useState } from 'react';
import {
  Box,
  Card,
  IconButton,
  Typography,
  Button,
  Stack,
  Fade,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ChatCircle,
  PaperPlaneTilt,
} from '@phosphor-icons/react';

const OnboardingAssistant = ({ 
  visible = true, 
  currentStep = 0, 
  totalSteps = 5, 
  onNext, 
  onPrevious,
  onFinish,
  stepTitle = "Install HandIt",
  position = "bottom-right",
  chatPosition = "bottom-right" // Position for the floating chat when opened
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Handle chat message submission
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Open the floating chat with the message
    window.dispatchEvent(new CustomEvent('openOnboardingChat', { 
      detail: { mode: 'assistant', message: chatInput.trim(), position: chatPosition } 
    }));
    
    // Clear the input
    setChatInput('');
  };

  if (!visible) return null;

  const stepsLeft = totalSteps - currentStep - 1;
  const isLastStep = currentStep === totalSteps - 1;

  // Calculate position styles based on position prop
  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-center':
        return {
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom-left':
        return {
          bottom: 20,
          left: 20,
        };
      case 'bottom-right':
      default:
        return {
          bottom: 20,
          right: 20,
        };
    }
  };

  return (
    <Fade in={visible}>
      <Box
        sx={{
          position: 'fixed',
          zIndex: 9998,
          ...getPositionStyles(),
        }}
      >
        {!isMinimized ? (
          <Card
            sx={{
              bgcolor: '#333333',
              color: 'white',
              borderRadius: 1.5,
              overflow: 'hidden',
              minWidth: 600,
              maxWidth: 600,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Content */}
            <Box sx={{ p: 2 }}>
              {/* Title */}
              <Typography 
                variant="h6" 
                sx={{ 
                  color: 'white', 
                  fontSize: '1rem',
                  fontWeight: 500,
                  mb: 1.5,
                  textAlign: 'center'
                }}
              >
                {stepTitle}
              </Typography>
              
              {/* Progress Dots */}
              <Stack 
                direction="row" 
                spacing={1} 
                sx={{ 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mb: 2 
                }}
              >
                {Array.from({ length: totalSteps }).map((_, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: index <= currentStep ? '#71f2af' : '#666666',
                      transition: 'background-color 0.3s ease',
                    }}
                  />
                ))}
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: '#999', 
                    ml: 2,
                    fontSize: '0.75rem'
                  }}
                >
                  {stepsLeft} steps left
                </Typography>
              </Stack>

              {/* Buttons and Chat Input on Same Line */}
              <Stack direction="row" spacing={2} alignItems="center" sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', pt: 2 }}>
                {/* Buttons */}
                

                {/* Chat Input */}
                <Box sx={{ flex: 1 }}>
                  <form onSubmit={handleChatSubmit}>
                    <TextField
                      fullWidth
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask me anything..."
                      variant="outlined"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 1.5,
                          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
                          '&.Mui-focused fieldset': { borderColor: '#71f2af' },
                        },
                        '& .MuiOutlinedInput-input': {
                          color: 'white',
                          fontSize: '0.875rem',
                          py: 0.5,
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
                              disabled={!chatInput.trim()}
                              sx={{
                                color: chatInput.trim() ? '#71f2af' : 'rgba(255, 255, 255, 0.3)',
                                '&:hover': {
                                  bgcolor: 'rgba(113, 242, 175, 0.1)'
                                },
                                '&.Mui-disabled': {
                                  color: 'rgba(255, 255, 255, 0.3)'
                                }
                              }}
                            >
                              <PaperPlaneTilt size={16} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </form>
                </Box>

                <Stack direction="row" spacing={1.5}>
                  {/* Back Button - Show on all steps except the very first step of the entire flow */}
                  {currentStep > 0 && onPrevious && (
                    <Button
                      variant="text"
                      onClick={onPrevious}
                      sx={{
                        color: 'white',
                        textTransform: 'none',
                        fontSize: '0.8rem',
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        px: 2.5,
                        py: 0.4,
                        minHeight: 'unset',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.2)'
                        }
                      }}
                    >
                      Back
                    </Button>
                  )}
                  
                  {/* Next Button - Always show */}
                  <Button
                    variant="text"
                    onClick={onNext}
                    sx={{
                      color: 'white',
                      textTransform: 'none',
                      fontSize: '0.8rem',
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      px: 2.5,
                      py: 0.4,
                      minHeight: 'unset',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.2)'
                      }
                    }}
                  >
                    Next
                  </Button>
                  
                  {/* Finish Button - Always show */}
                  <Button
                    variant="text"
                    onClick={onFinish}
                    sx={{
                      color: 'white',
                      textTransform: 'none',
                      fontSize: '0.8rem',
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      px: 2.5,
                      py: 0.4,
                      minHeight: 'unset',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.2)'
                      }
                    }}
                  >
                    Finish
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Card>
        ) : (
          // Minimized state
          <Card
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: '50%',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: (theme) => theme.shadows[4],
              border: '2px solid',
              borderColor: 'background.paper',
              '&:hover': {
                boxShadow: (theme) => theme.shadows[8],
                transform: 'scale(1.05)',
              },
              transition: 'all 0.2s ease'
            }}
            onClick={() => setIsMinimized(false)}
          >
            <ChatCircle size={24} weight="fill" />
          </Card>
        )}
      </Box>
    </Fade>
  );
};

export default OnboardingAssistant; 