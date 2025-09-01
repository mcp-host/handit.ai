/**
 * Tracing Modal Component
 * 
 * A comprehensive modal component that visualizes and provides detailed information
 * about agent execution traces. Features include:
 * - Interactive flow visualization using ReactFlow
 * - Detailed node and entry information display
 * - Support for multiple execution cycles
 * - Error visualization and handling
 * - Image attachment viewing
 * - Evaluation capabilities for admin users
 */

'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Backdrop,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slide,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { CaretDown, WarningOctagon, X as XIcon } from '@phosphor-icons/react';
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge';
import ReactJson from 'react-json-view';
import { Carousel } from 'react-responsive-carousel';
import ReactFlow, { Background, Controls, MarkerType, ReactFlowProvider } from 'reactflow';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { parseAttachments, parseContext, parseInputContent, parseOutputContent } from '@/lib/parsers';
import { useUser } from '@/hooks/use-user';

import { MonitoringNode } from './monitoring-node';
import { TracingDeploymentNode } from './tracing-deployment-node';
import { TracingToolNode } from './tracing-tool-node';

import 'react-responsive-carousel/lib/styles/carousel.min.css';

import { useUpdateEntryMutation } from '@/services/monitoringService';

/**
 * Slide transition component for the modal
 */
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="left" ref={ref} {...props} />;
});

// Register custom node types for tracing modal
const nodeTypes = {
  custom: MonitoringNode,
  deploymentCustom: TracingDeploymentNode,
  toolCustom: TracingToolNode,
};

/**
 * ContentCard Component
 * 
 * A reusable component that displays content in a card format,
 * with special handling for JSON content.
 * 
 * @param {Object} props - Component props
 * @param {string} props.children - The content to display
 * @returns {JSX.Element} The content card component
 */
const ContentCard = ({ children }) => {
  // Check if content is JSON
  const isJSON = React.useMemo(() => {
    if (typeof children !== 'string') return false;
    try {
      const parsed = JSON.parse(children);
      if (typeof parsed !== 'object') return false;
      return true;
    } catch (e) {
      return false;
    }
  }, [children]);

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      {isJSON ? (
        <ReactJson
          src={JSON.parse(children)}
          theme="monokai"
          style={{
            backgroundColor: 'transparent',
            fontFamily: 'monospace',
            overflowX: 'auto',
          }}
          displayDataTypes={false}
          enableClipboard={false}
          collapsed={2}
        />
      ) : (
        <Typography
          variant="body2"
          component="pre"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {children}
        </Typography>
      )}
    </Card>
  );
};

/**
 * SectionTitle Component
 * 
 * A simple component for displaying section titles.
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The title content
 * @returns {JSX.Element} The section title component
 */
const SectionTitle = ({ children }) => <Typography variant="subtitle2">{children}</Typography>;

/**
 * AttachmentsSection Component
 * 
 * Displays a grid of image attachments with support for pagination
 * and full-size image viewing.
 * 
 * @param {Object} props - Component props
 * @param {Array<string>} props.attachments - Array of image URLs
 * @param {Function} props.onImageSelect - Callback when an image is selected
 * @param {boolean} [props.onScreen] - Whether to show all images on screen
 * @returns {JSX.Element|null} The attachments section component or null if no attachments
 */
export const AttachmentsSection = ({ attachments, onImageSelect, onScreen }) => {
  const [selectedImage, setSelectedImage] = React.useState(null);

  if (!attachments?.length) return null;

  const displayLimit = onScreen || 3;
  const hasMoreImages = attachments.length > displayLimit;
  const displayImages = attachments.slice(0, displayLimit);
  const remainingCount = attachments.length - displayLimit;

  return (
    <>
      <SectionTitle>Attachments:</SectionTitle>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={1}>
          {displayImages.map((attachment, index) => (
            <Grid item xs={3} key={index}>
              <Box
                onClick={() => setSelectedImage(attachment)}
                sx={{
                  position: 'relative',
                  paddingTop: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxHeight: '100px',
                  maxWidth: '100px',
                }}
              >
                <img
                  src={attachment}
                  alt={`Attachment ${index + 1}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    maxHeight: '100px',
                    maxWidth: '100px',
                    borderRadius: '10px',
                  }}
                />
              </Box>
            </Grid>
          ))}
          {hasMoreImages && (
            <Grid item xs={3}>
              <Box
                onClick={() => setSelectedImage(attachments[displayLimit])}
                sx={{
                  position: 'relative',
                  paddingTop: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  overflow: 'hidden',
                  maxHeight: '100px',
                  maxWidth: '100px',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                  }}
                >
                  <img
                    src={attachments[displayLimit]}
                    alt={`Attachment ${displayLimit + 1}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'brightness(0.3) blur(4px)',
                    }}
                  />

                  <Typography
                    variant="h6"
                    sx={{
                      color: 'white',
                      zIndex: 1,
                      fontWeight: 'bold',
                    }}
                  >
                    +{remainingCount}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </Card>

      <ImageDialog
        open={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        images={attachments}
        initialImage={selectedImage}
      />
    </>
  );
};

/**
 * ImageDialog Component
 * 
 * A dialog for viewing full-size images with navigation controls.
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {Function} props.onClose - Callback when dialog is closed
 * @param {Array<string>} [props.images=[]] - Array of image URLs
 * @param {string} [props.initialImage] - The initially selected image
 * @returns {JSX.Element|null} The image dialog component or null if no images
 */
const ImageDialog = ({ open, onClose, images = [], initialImage }) => {
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  React.useEffect(() => {
    if (initialImage && images?.length) {
      const index = images.findIndex((img) => img === initialImage);
      if (index !== -1) setSelectedImageIndex(index);
    }
  }, [initialImage, images]);

  if (!images?.length) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'background.default' },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.7)',
            },
            zIndex: 1,
          }}
        >
          <XIcon />
        </IconButton>

        <Box sx={{ mb: 2 }}>
          <img
            src={images[selectedImageIndex]}
            alt={`Full size ${selectedImageIndex + 1}`}
            style={{
              width: '100%',
              maxHeight: '70vh',
              objectFit: 'contain',
            }}
          />
        </Box>

        <Grid container spacing={1} sx={{ mt: 2 }}>
          {images.map((image, index) => (
            <Grid item xs={2} sm={1.5} key={index}>
              <Box
                onClick={() => setSelectedImageIndex(index)}
                sx={{
                  position: 'relative',
                  paddingTop: '100%',
                  cursor: 'pointer',
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: selectedImageIndex === index ? '2px solid primary.main' : 'none',
                }}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

/**
 * NodeDetails Component
 * 
 * Displays detailed information about a specific node in the execution flow,
 * including input/output data, metrics, and evaluation options for admins.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.node - The node data to display
 * @param {Array} props.cycles - Available execution cycles
 * @param {number} props.selectedCycle - Currently selected cycle index
 * @param {Function} props.onCycleChange - Callback when cycle selection changes
 * @param {Function} props.onImageSelect - Callback when an image is selected
 * @param {Object} props.model - The model data for evaluation
 * @param {Function} props.onNodeUpdate - Callback when node data is updated
 * @param {number} props.currentStepIndex - Current step index
 * @returns {JSX.Element} The node details component
 */
const NodeDetails = ({
  node,
  cycles,
  selectedCycle,
  onCycleChange,
  onImageSelect,
  model,
  onNodeUpdate,
  currentStepIndex,
  disableCycles = false,
}) => {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [step, setStep] = React.useState(node?.data?.steps?.[node?.data?.selectedCycleIndex]);
  const [allSteps, setAllSteps] = React.useState([]);

  const [nodeAttachments, setNodeAttachments] = React.useState([]);
  const [expanded, setExpanded] = React.useState(['output']);
  const [updateEntry] = useUpdateEntryMutation();
  // Add state for evaluation fields
  const [relevance, setRelevance] = React.useState(step?.actual?.relevance || 0);
  const [coherence, setCoherence] = React.useState(step?.actual?.coherence || 0);
  const [correctness, setCorrectness] = React.useState(node?.data?.step?.actual?.correct || false);
  const [realClass, setRealClass] = React.useState(
    typeof step?.actual?.class === 'string' ? step?.actual?.class : JSON.stringify(step?.actual?.class) || ''
  );
  const [modelClass, setModelClass] = React.useState(
    typeof step?.actual?.modelClass === 'string'
      ? step?.actual?.modelClass
      : JSON.stringify(step?.actual?.modelClass) || ''
  );
  const [selectedLabels, setSelectedLabels] = React.useState(step?.actual?.selectedLabels || []);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (disableCycles && node?.data?.steps) {
      // Get all steps for this node when cycles are disabled
      setAllSteps(node.data.steps);
      setStep(node.data.steps[0]); // Set first step as default
    } else {
      const step = node?.data?.steps?.[selectedCycle];
      setStep(step);
      setAllSteps([step].filter(Boolean));
    }
  }, [node, selectedCycle, disableCycles]);

  React.useEffect(() => {
    setRelevance(step?.actual?.relevance || 0);
    setCoherence(step?.actual?.coherence || 0);
    setCorrectness(step?.actual?.correct || false);
    setRealClass(step?.actual?.class || '');
    setModelClass(step?.actual?.modelClass || '');
    setSelectedLabels(step?.actual?.selectedLabels || []);
  }, [step]);

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? [...expanded, panel] : expanded.filter((p) => p !== panel));
  };

  React.useEffect(() => {
    if (step?.actual?.relevance) {
      setRelevance(step?.actual?.relevance);
    } else {
      setRelevance(0);
    }
    if (step?.actual?.coherence) {
      setCoherence(step?.actual?.coherence);
    } else {
      setCoherence(0);
    }
    if (step?.actual?.correct) {
      setCorrectness(step?.actual?.correct);
    } else {
      setCorrectness(false);
    }
    if (step?.actual?.class) {
      setRealClass(typeof step?.actual?.class === 'string' ? step?.actual?.class : JSON.stringify(step?.actual?.class));
    } else {
      setRealClass('');
    }
    if (step?.actual?.modelClass) {
      setModelClass(
        typeof step?.actual?.modelClass === 'string'
          ? step?.actual?.modelClass
          : JSON.stringify(step?.actual?.modelClass)
      );
    } else {
      setModelClass('');
    }
    if (step?.actual?.selectedLabels) {
      setSelectedLabels(step?.actual?.selectedLabels);
    } else {
      setSelectedLabels([]);
    }
  }, [step]);

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    switch (field) {
      case 'relevance':
        setRelevance(Number(value));
        break;
      case 'coherence':
        setCoherence(Number(value));
        break;
      case 'correctness':
        setCorrectness(value);
        break;
      case 'realClass':
        setRealClass(value);
        break;
      case 'modelClass':
        setModelClass(value);
        break;
      case 'selectedLabels':
        setSelectedLabels(value);
        break;
    }
  };
  const parseEvaluationInsight = (evaluator, index) => {
    if (evaluator instanceof Object && evaluator.analysis) {
      return evaluator.evaluator + ': ' + evaluator.analysis;
    }
    evaluator = evaluator.replaceAll('```json', '').replaceAll('```', '');
    try {
      evaluator = JSON.parse(evaluator);
    } catch (error) {
      return '';
    }
    if (index === 0) {
      if (typeof evaluator.evaluation === 'object') {
        return evaluator.evaluation.justification;

      } else if (typeof evaluator.evaluation === 'string') {
        return evaluator.evaluation;
      }
    } else if (index === 1) {
      if (evaluator.status === 'COMPLETE') {
        return 'All required fields have been successfully extracted.';
      } else {
        return 'Some required fields were not extracted.';
      }
    } else {
      return evaluator.severity_analysis;
    }

  };

  const handleSave = async () => {
    setLoading(true);
    await updateEntry({
      id: node?.data?.step?.logId,
      actual: model?.problemType?.includes('class')
        ? { class: realClass, modelClass: modelClass }
        : {
          relevance: relevance,
          coherence: coherence,
          correct: correctness,
        },
      processed: true,
      isCorrect: model?.problemType?.includes('class') ? realClass == modelClass : correctness,
    });
    const updatedNode = {
      ...node,
      data: {
        ...node.data,
        step: {
          ...node.data.step,
          actual: {
            ...step.actual,
            relevance: relevance,
            coherence: coherence,
            correct: correctness,
            class: realClass,
            modelClass: modelClass,
            selectedLabels: selectedLabels,
          },
        },
      },
    };
    // Call the callback to update parent state
    onNodeUpdate(updatedNode);

    setLoading(false);
  };

  const renderEvaluationFields = () => {
    if (model?.problemType?.includes('class')) {
      return (
        <Grid container spacing={4}>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Correct Classification</InputLabel>
              <Select value={realClass} onChange={handleChange('realClass')} label="Correct Classification">
                {(model?.parameters?.classes || ['Positive', 'Negative']).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
                {!model?.parameters?.classes?.includes(realClass) && <MenuItem value={realClass}>{realClass}</MenuItem>}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Model Classification</InputLabel>
              <Select value={modelClass} onChange={handleChange('modelClass')} label="Model Classification">
                {(model?.parameters?.classes || ['Positive', 'Negative']).map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
                {!model?.parameters?.classes?.includes(modelClass) && (
                  <MenuItem value={modelClass}>{modelClass}</MenuItem>
                )}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      );
    } else {
      return (
        <Grid container spacing={4}>
          <Grid item xs={4}>
            <TextField
              label="Relevance"
              type="number"
              value={String(relevance)}
              onChange={handleChange('relevance')}
              fullWidth
              inputProps={{ min: 0, max: 10 }}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Coherence"
              type="number"
              value={String(coherence)}
              onChange={handleChange('coherence')}
              fullWidth
              inputProps={{ min: 0, max: 10 }}
            />
          </Grid>
          <Grid item xs={4}>
            <FormControl fullWidth>
              <InputLabel>Correctness</InputLabel>
              <Select value={correctness} onChange={handleChange('correctness')} label="Correctness">
                <MenuItem value={true}>Correct</MenuItem>
                <MenuItem value={false}>Incorrect</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      );
    }
  };

  React.useEffect(() => {
    const loadAttachments = async () => {
      if (step?.input) {
        const attachments = await parseAttachments(step.input);
        setNodeAttachments(attachments);
      }
    };
    loadAttachments();
  }, [step]);


  const context = parseContext(step?.input, model);
  const observation = step?.input?.previousSteps?.map((step) => step.observation).join('\n\n');

  // Get all available steps for this node
  const steps = node?.data?.sequence || [];
  const currentStep = steps[currentStepIndex];

  if (step && step.error && !step.output && !step.input) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">Error Details</Typography>
        <Accordion
          expanded={expanded.includes('output')}
          onChange={handleAccordionChange('output')}
          sx={{
            '&:before': { display: 'none' },
            boxShadow: 'none',
            bgcolor: 'transparent',
          }}
        >
          <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
            <Typography variant="subtitle2">Error Details</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <ContentCard>
              {parseInputContent({
                error: step.error?.message,
                stack: step.error?.stack,
              })}
            </ContentCard>
          </AccordionDetails>
        </Accordion>
      </Stack>
    );
  }

  // Helper function to render step content
  const renderStepContent = (stepData, stepIndex = null) => {
    if (!stepData) return null;

    const context = parseContext(stepData?.input, model);
    const observation = stepData?.input?.previousSteps?.map((step) => step.observation).join('\n\n');
    
    const stepPrefix = stepIndex !== null ? `Step ${stepIndex + 1} - ` : '';

    return (
      <Box key={stepIndex} sx={{ mb: stepIndex !== null ? 4 : 0 }}>
        {stepIndex !== null && (
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
            Entry #{stepIndex + 1}
          </Typography>
        )}

        {stepData?.actual?.evaluations && stepData?.actual?.evaluations?.length > 0 && (
  <Box sx={{ mb: 2 }}>
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      {stepPrefix}Evaluation Insights
    </Typography>
    <List dense disablePadding>
      {stepData?.actual?.evaluations.map((evaluator, index) => (
        <ListItem key={index} sx={{ pl: 1, alignItems: 'flex-start', gap: 0 }} disableGutters>
          <ListItemIcon sx={{ minWidth: 24, mt: 0.5, height: 'auto' }}>
            <FiberManualRecordIcon sx={{ fontSize: 8 }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, alignItems: 'flex-start' }}>
                {parseEvaluationInsight(evaluator, index)}
              </Typography>
            }
          />
        </ListItem>
      ))}
    </List>
  </Box>
)}

        {context && (
          <Accordion
            expanded={expanded.includes(`system-${stepIndex || 0}`)}
            onChange={handleAccordionChange(`system-${stepIndex || 0}`)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
          >
            <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
              <Typography variant="subtitle2">{stepPrefix}System Prompt</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <ContentCard>{context}</ContentCard>
            </AccordionDetails>
          </Accordion>
        )}

        {observation && (
          <Accordion
            expanded={expanded.includes(`observation-${stepIndex || 0}`)}
            onChange={handleAccordionChange(`observation-${stepIndex || 0}`)}
            sx={{
              '&:before': { display: 'none' },
              boxShadow: 'none',
              bgcolor: 'transparent',
            }}
          >
            <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
              <Typography variant="subtitle2">{stepPrefix}RAG Observations</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0 }}>
              <ContentCard>{observation}</ContentCard>
            </AccordionDetails>
          </Accordion>
        )}

        <Accordion
          expanded={expanded.includes(`input-${stepIndex || 0}`)}
          onChange={handleAccordionChange(`input-${stepIndex || 0}`)}
          sx={{
            '&:before': { display: 'none' },
            boxShadow: 'none',
            bgcolor: 'transparent',
          }}
        >
          <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
            <Typography variant="subtitle2">{stepPrefix}{context ? 'User Prompt:' : 'Input:'}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <ContentCard>{parseInputContent(stepData.input, model)}</ContentCard>
          </AccordionDetails>
        </Accordion>

        <Accordion
          expanded={expanded.includes(`output-${stepIndex || 0}`)}
          onChange={handleAccordionChange(`output-${stepIndex || 0}`)}
          sx={{
            '&:before': { display: 'none' },
            boxShadow: 'none',
            bgcolor: 'transparent',
          }}
        >
          <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
            <Typography variant="subtitle2">{stepPrefix}Output:</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <ContentCard>{parseOutputContent(stepData.output)}</ContentCard>
          </AccordionDetails>
        </Accordion>

        {stepIndex !== null && stepIndex < allSteps.length - 1 && (
          <Box sx={{ my: 3, borderBottom: 1, borderColor: 'divider' }} />
        )}
      </Box>
    );
  };

  return (
    <Stack spacing={3} sx={{ position: 'relative' }}>
      <Backdrop
        open={loading}
        sx={{
          position: 'absolute',
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        }}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      <Typography variant="h6">{node.data.label}</Typography>
      <Typography color="text.secondary" variant="body2">
        Type: {node.data.type}
      </Typography>
      {node.data.type === 'model' && node.data.status === 'error' && (
        <Typography color="text.secondary" variant="body2">
          Status: Handit detected an error.
        </Typography>
      )}

      {disableCycles && allSteps.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgb(253, 151, 31)' }}>
            This node was executed {allSteps.length} times. All entries are shown below:
          </Typography>
        </Box>
      )}

      {!disableCycles && cycles.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgb(253, 151, 31)' }}>
            Please select the cycle you want to debug:
          </Typography>
          <FormControl fullWidth size="small">
            <Select value={selectedCycle} onChange={onCycleChange} displayEmpty>
              {cycles.map((cycle, index) => (
                <MenuItem key={index} value={index}>
                  Cycle {index + 1}: Steps {cycle.steps.join(' → ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {disableCycles ? (
        // Render all steps when cycles are disabled
        allSteps.map((stepData, index) => renderStepContent(stepData, index))
      ) : (
        // Render single step when cycles are enabled
        step && renderStepContent(step)
      )}

      {step && (
        <>
          <AttachmentsSection attachments={nodeAttachments} onImageSelect={onImageSelect} />

          {/* Add evaluation section for admins */}
          {isAdmin && node.data.type !== 'tool' && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Evaluation
              </Typography>
              {renderEvaluationFields()}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }} disabled={loading}>
                Save Evaluation
              </Button>
            </Box>
          )}
        </>
      )}
    </Stack>
  );
};

/**
 * EntryOverview Component
 * 
 * Displays an overview of the entry execution, including status,
 * duration, and input/output data.
 * 
 * @param {Object} props - Component props
 * @param {Object} props.entryFlow - The entry flow data
 * @param {Function} props.onImageSelect - Callback when an image is selected
 * @param {Object} props.entry - The entry data
 * @param {Array} props.cycles - Available execution cycles
 * @param {number} props.selectedCycle - Currently selected cycle index
 * @param {Function} props.onCycleChange - Callback when cycle selection changes
 * @param {Object} props.model - The model data for parsing
 * @returns {JSX.Element} The entry overview component
 */
const EntryOverview = ({ entryFlow, onImageSelect, entry, cycles, selectedCycle, onCycleChange, model, disableCycles = false }) => {
  const [entryAttachments, setEntryAttachments] = React.useState([]);
  const [expanded, setExpanded] = React.useState(['output']);

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? [...expanded, panel] : expanded.filter((p) => p !== panel));
  };

  React.useEffect(() => {
    const loadAttachments = async () => {
      if (entry?.input) {
        const attachments = await parseAttachments(entry.input);
        setEntryAttachments(attachments);
      }
    };
    loadAttachments();
  }, [entry]);

  const context = parseContext(entry?.input, model);
  const getDisplayStatus = (status) => {
    return status;
  };
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Agent Entry Overview</Typography>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Status
        </Typography>
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {getDisplayStatus(entry?.status)}
        </Typography>
      </Box>

      {entry?.duration && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Duration
          </Typography>
          <Typography variant="body2">{(entry?.duration / 1000).toFixed(2)}s</Typography>
        </Box>
      )}

      {!disableCycles && cycles.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgb(253, 151, 31)' }}>
            Please select a specific cycle to debug:
          </Typography>
          <FormControl fullWidth size="small">
            <Select value={selectedCycle} onChange={onCycleChange} displayEmpty>
              {cycles.map((cycle, index) => (
                <MenuItem key={index} value={index}>
                  Cycle {index + 1}: Steps {cycle.steps.join(' → ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {disableCycles && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgb(253, 151, 31)' }}>
            Showing all execution steps in a single flow.
          </Typography>
        </Box>
      )}

      {context && (
        <Accordion
          expanded={expanded.includes('system')}
          onChange={handleAccordionChange('system')}
          sx={{
            '&:before': { display: 'none' },
            boxShadow: 'none',
            bgcolor: 'transparent',
          }}
        >
          <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
            <Typography variant="subtitle2">System Prompt</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <ContentCard>{context}</ContentCard>
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion
        expanded={expanded.includes('input')}
        onChange={handleAccordionChange('input')}
        sx={{
          '&:before': { display: 'none' },
          boxShadow: 'none',
          bgcolor: 'transparent',
        }}
      >
        <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
          <Typography variant="subtitle2">{context ? 'User Prompt:' : 'Input:'}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <ContentCard>{parseInputContent(entry?.input, model)}</ContentCard>
        </AccordionDetails>
      </Accordion>

      <AttachmentsSection attachments={entryAttachments} onImageSelect={onImageSelect} />

      <Accordion
        expanded={expanded.includes('output')}
        onChange={handleAccordionChange('output')}
        sx={{
          '&:before': { display: 'none' },
          boxShadow: 'none',
          bgcolor: 'transparent',
        }}
      >
        <AccordionSummary expandIcon={<CaretDown />} sx={{ px: 0, minHeight: 'unset' }}>
          <Typography variant="subtitle2">Output:</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <ContentCard>{parseOutputContent(entryFlow?.steps?.[entryFlow?.steps?.length - 1]?.output)}</ContentCard>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

// Modify the detectCycles function to return both nodes and edges for each cycle

const connectFullCycle = (cycle, edges) => {
  cycle.edges = [];
  const nodes = cycle.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const edgesGoingFromNode = edges.filter((edge) => edge.source === nodes[i] && cycle.nodes.includes(edge.target));
    edgesGoingFromNode.forEach((edge) => {
      cycle.edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        isPhantom: false,
      });
    });
  }
  return cycle;
};

// Create a single cycle with all steps when cycles are disabled
const createSingleCycle = (nodes, edges) => {
  // Get all steps from all nodes
  const allSteps = [];
  nodes.forEach(node => {
    if (node.data.sequence) {
      node.data.sequence.forEach(step => {
        if (!allSteps.includes(step)) {
          allSteps.push(step);
        }
      });
    }
  });
  
  // Sort steps
  allSteps.sort((a, b) => a - b);
  
  // Get all unique node IDs
  const allNodeIds = [...new Set(nodes.map(node => node.id))];
  
  return [{
    steps: allSteps,
    nodes: allNodeIds,
    edges: connectFullCycle({ nodes: allNodeIds, edges: [] }, edges).edges,
  }];
};

const detectCycles = (nodes, edges) => {
  let cycles = [];
  let currentCycle = {
    steps: [],
    nodes: [],
    edges: [],
  };

  const findCycle = (startStep) => {
    const visited = new Set();
    let currentStep = startStep;
    let currentNode = nodes.find((node) => node.data.sequence?.includes(currentStep));

    if (!currentNode) return;

    currentCycle.steps = [currentStep];
    currentCycle.nodes = [currentNode.id];
    visited.add(currentNode.id);

    while (true) {
      let nextStep = currentStep + 1;
      let nextNode = nodes.find((node) => node.data.sequence?.includes(nextStep));

      if (!nextNode) {
        // if no next node, i want to first check if there is a future step that has a node, and then use it
        const futureStep = nodes.find((node) => node.data.sequence?.includes(nextStep + 1));
        if (futureStep) {
          nextStep = nextStep + 1;
          nextNode = futureStep;
        } else {
          // End of sequence, save cycle
          if (currentCycle.steps.length > 1) {
            cycles.push({ ...currentCycle });
          }
          return;
        }
      }

      // Add step and node to cycle
      currentCycle.steps.push(nextStep);
      currentCycle.nodes.push(nextNode.id);

      // Find connecting edge or create phantom edge
      const existingEdge = edges.find((edge) => edge.source === currentNode.id && edge.target === nextNode.id);

      if (existingEdge) {
        currentCycle.edges.push({
          id: existingEdge.id,
          source: currentNode.id,
          target: nextNode.id,
          isPhantom: false,
        });
      } else {
        currentCycle.edges.push({
          id: `phantom-${currentNode.id}-${nextNode.id}`,
          source: currentNode.id,
          target: nextNode.id,
          isPhantom: true,
          type: 'smart',
        });
      }

      if (visited.has(nextNode.id)) {
        // We found a cycle, save it and start new cycle from next step
        if (currentCycle.steps.length > 1) {
          cycles.push({ ...currentCycle });
        }
        currentCycle = {
          steps: [],
          nodes: [],
          edges: [],
        };
        return findCycle(nextStep);
      }

      visited.add(nextNode.id);
      currentStep = nextStep;
      currentNode = nextNode;
    }
  };

  // Start finding cycles from step 1
  findCycle(1);
  if (cycles.length === 0) {
    cycles.push(currentCycle);
  }

  if (cycles.length === 1) {
    cycles = [connectFullCycle(cycles[0], edges)];
  }
  return cycles;
};

/**
 * TracingModal Component
 * 
 * The main component that provides a comprehensive view of agent execution traces.
 * Features include:
 * - Interactive flow visualization
 * - Detailed node and entry information
 * - Support for multiple execution cycles
 * - Error visualization
 * - Image attachment viewing
 * - Evaluation capabilities for admins
 * 
 * @param {Object} props - Component props
 * @param {Object} props.entry - The entry data
 * @param {Array} props.nodes - The nodes to display in the flow
 * @param {Array} props.edges - The edges connecting the nodes
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {boolean} [props.open=false] - Whether the modal is open
 * @param {Object} props.entryFlow - The entry flow data
 * @param {boolean} props.isLoading - Whether data is loading
 * @param {Function} [props.onNodeUpdate=()=>{}] - Callback when node data is updated
 * @param {string} [props.preSelectedNodeId=null] - ID of node to pre-select
 * @returns {JSX.Element} The tracing modal component
 */
export function TracingModal({
  entry,
  nodes,
  edges,
  onClose,
  open = false,
  entryFlow,
  isLoading,
  onNodeUpdate = () => { },
  preSelectedNodeId = null,
}) {
  // Flag to disable cycles functionality - set to true to show all entries in one flow
  const [disableCycles, setDisableCycles] = React.useState(true);
  
  const [selectedNode, setSelectedNode] = React.useState(null);
  const [processedNodes, setProcessedNodes] = React.useState([]);
  const [processedEdges, setProcessedEdges] = React.useState([]);
  const [flowKey, setFlowKey] = React.useState(0);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const model = selectedNode?.data?.Model;
  const [selectedStep, setSelectedStep] = React.useState(null);
  const [highlightedPath, setHighlightedPath] = React.useState({ nodes: [], edges: [] });
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [cycles, setCycles] = React.useState([]);
  const [selectedCycle, setSelectedCycle] = React.useState(0);
  const [regularEdges, setRegularEdges] = React.useState([]);
  const [initialViewport, setInitialViewport] = React.useState({ x: 0, y: 0, zoom: 0.8 });

  // Effect to handle pre-selected node when modal opens
  React.useEffect(() => {
    if (open && preSelectedNodeId && nodes.length > 0) {
      const nodeToSelect = nodes.find((node) => node.id == preSelectedNodeId);

      if (nodeToSelect) {
        const step = nodeToSelect?.data?.sequence?.[0];

        setSelectedNode(nodeToSelect);
        setSelectedStep(step);
        setCurrentStepIndex(0);
        const path = findStepPath(step);
        setHighlightedPath(path);
      }
    } else if (open && !preSelectedNodeId && nodes.length > 0) {
      const nodeToSelect = nodes.find((node) => node?.data?.initialNode);

      if (nodeToSelect) {
        const step = nodeToSelect?.data?.sequence?.[0];
        setSelectedNode(nodeToSelect);
        setSelectedStep(step);
        setCurrentStepIndex(0);
        const path = findStepPath(step);
        setHighlightedPath(path);
      }
    }
  }, [open, preSelectedNodeId, nodes]);

  // Add effect to detect cycles when nodes change
  React.useEffect(() => {
    if (nodes.length > 0) {
      const detectedCycles = disableCycles ? createSingleCycle(nodes, edges) : detectCycles(nodes, edges);
      setCycles(detectedCycles);
      if (detectedCycles.length > 0) {
        setSelectedCycle(0);
        setRegularEdges(edges);
        setHighlightedPath({
          nodes: detectedCycles[0].nodes,
          edges: detectedCycles[0].edges,
        });
      }
    }
  }, [nodes, edges, disableCycles]);

  // Modify the cycle selection handler
  const handleCycleChange = (event) => {
    const cycleIndex = parseInt(event.target.value);
    setSelectedCycle(cycleIndex);

    // Clear previous highlighting and set new path
    setHighlightedPath({
      nodes: cycles[cycleIndex].nodes,
      edges: cycles[cycleIndex].edges,
    });
  };

  const ErrorEnd = React.useCallback(({ id, sourceX, sourceY, targetX, targetY, data, style = {} }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const errorColor = 'rgba(211, 47, 47, 0.8)';
    const errorColorDark = 'rgba(211, 47, 47, 1)';

    const handleClick = (e) => {
      e.stopPropagation();
      if (data?.onClick) {
        data.onClick();
      }
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    // Calculate adjusted target point to create space for the larger triangle
    const triangleSize = 40; // Increased size
    const spacing = 40; // Increased space between line end and triangle
    const adjustedTargetY = targetY - spacing;

    return (
      <g
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      >
        {/* Calculate control points for the curve */}
        {(() => {
          const deltaY = adjustedTargetY - sourceY;
          const controlY = deltaY * 0.5;

          const path = `M ${sourceX} ${sourceY} 
                    C ${sourceX} ${sourceY + controlY},
                      ${targetX} ${targetY - controlY},
                      ${targetX} ${targetY}`;

          return (
            <>
              {/* Background click area */}
              <path
                d={path}
                stroke="transparent"
                strokeWidth={20}
                fill="none"
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              />
              {/* Visible curved line */}
              <path
                d={path}
                stroke={isHovered ? errorColorDark : errorColor}
                strokeWidth={isHovered ? 4 : 3}
                fill="none"
                style={{ transition: 'all 0.2s ease' }}
              />
            </>
          );
        })()}

        {/* Warning triangle and exclamation mark */}
        <g
          transform={`translate(${targetX - triangleSize} ${targetY - 20})`}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        >
          {/* Larger invisible hit area */}
          <rect
            x="-10"
            y="-10"
            width={triangleSize * 2 + 50}
            height={triangleSize * 2 + 50}
            fill="rgba(0, 0, 0, 0)" /* Ensure it's clickable */
            pointerEvents="all"
            onClick={handleClick}
          />
          {/* Larger triangle */}
          <path
            d={`M${triangleSize} 0 L${triangleSize * 2} ${triangleSize * 2} L0 ${triangleSize * 2} Z`}
            fill={isHovered ? errorColorDark : errorColor}
            style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
            pointerEvents="all"
            onClick={handleClick}
          />
          {/* Adjusted exclamation mark for larger triangle */}
          <path
            d={`M${triangleSize - 3} ${triangleSize * 0.7}
            h6l-1 ${triangleSize * 0.7}h-4l-1-${triangleSize * 0.5}z
            M${triangleSize - 3} ${triangleSize * 1.5}
            h6v6h-6v-6z`}
            fill="white"
            pointerEvents="none" /* Ensure text does not block clicks */
          />
        </g>
      </g>
    );
  }, []); // Empty dependency array since it doesn't depend on any props

  // Custom edge component for error edges
  const ErrorEdge = React.useCallback(({ id, sourceX, sourceY, targetX, targetY, data, style = {} }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const errorColor = 'rgba(211, 47, 47, 1)';
    const errorColorDark = 'rgba(211, 47, 47, 1)';

    const handleClick = (e) => {
      e.stopPropagation();
      if (data?.onClick) {
        data.onClick();
      }
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    return (
      <g
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
      >
        {/* Calculate control points for the curve */}
        {(() => {
          const midX = (sourceX + targetX) / 2;
          const midY = (sourceY + targetY) / 2;
          const deltaY = targetY - sourceY;
          const controlY = deltaY * 0.5;

          const path = `M ${sourceX} ${sourceY} 
                        C ${sourceX} ${sourceY + controlY},
                          ${targetX} ${targetY - controlY},
                          ${targetX} ${targetY}`;

          return (
            <>
              {/* Background click area */}
              <path d={path} stroke="transparent" strokeWidth={20} fill="none" style={{ cursor: 'pointer' }} />
              {/* Visible curved line */}
              <path
                d={path}
                stroke={isHovered ? errorColorDark : errorColor}
                strokeWidth={isHovered ? 4 : 3}
                fill="none"
                style={{ transition: 'all 0.2s ease' }}
              />
            </>
          );
        })()}

        {/* Warning triangle and exclamation mark */}
        <g
          transform={`translate(${(sourceX + targetX) / 2 - 15} ${(sourceY + targetY) / 2 - 15})`}
          style={{ cursor: 'pointer', zIndex: 1000 }}
        >
          <rect x="0" y="0" width="30" height="30" fill="transparent" />
          <path
            d="M15 2 L28 26 L2 26 Z"
            fill={isHovered ? errorColorDark : errorColor}
            style={{ transition: 'all 0.2s ease' }}
          />
          <path d="M13.5 8h3l-0.5 10h-2l-0.5-10zM13.5 20h3v3h-3v-3z" fill="white" style={{ zIndex: 1000 }} />
        </g>
      </g>
    );
  }, []); // Empty dependency array since it doesn't depend on any props

  const RoundEdge = React.useCallback(({ id, sourceX, sourceY, targetX, targetY, style = {}, markerEnd }) => {
    // Calculate the midpoint and distance
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate control point offset (perpendicular to the line)
    const offset = Math.min(distance * 0.5, 150); // Cap maximum offset
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    // Calculate perpendicular vector
    const perpX = -dy / distance;
    const perpY = dx / distance;

    // Calculate control point
    const controlX = midX + perpX * offset;
    const controlY = midY + perpY * offset;

    // Create SVG path with quadratic Bezier curve
    const path = `
      M ${sourceX} ${sourceY}
      Q ${controlX} ${controlY} ${targetX} ${targetY}
    `;

    return (
      <g>
        {/* Main curved path */}
        <path
          d={path}
          stroke={style.stroke || 'rgba(0, 0, 0, 0.2)'}
          strokeWidth={style.strokeWidth || 2}
          strokeDasharray={style.strokeDasharray}
          fill="none"
          style={{
            ...style,
            transition: 'stroke 0.2s, stroke-width 0.2s',
            zIndex: 1000,
          }}
          markerEnd={markerEnd}
        />
      </g>
    );
  }, []);

  // Memoize edgeTypes
  const edgeTypes = React.useMemo(
    () => ({
      'error-edge': ErrorEdge,
      'error-end': ErrorEnd,
      smart: RoundEdge,
    }),
    [ErrorEdge, ErrorEnd, RoundEdge]
  );

  React.useEffect(() => {
    if (
      (entry?.status === 'failed' || entry?.status === 'error') &&
      !entryFlow?.steps?.some((step) => step.status === 'failed' || step.status === 'error')
    ) {
      // Find the last executed node
      const lastExecutedStep = entryFlow?.steps?.[entryFlow.steps.length - 1];
      const lastNodeId = (lastExecutedStep?.mappingnodeid ? lastExecutedStep?.mappingnodeid : lastExecutedStep?.nodeId).toString();

      // Find outgoing edges from the last node
      const outgoingEdges = edges.filter((edge) => edge.source === lastNodeId);
      if (outgoingEdges.length > 0) {
        // Add error marker to outgoing edges
        const updatedEdges = edges.map((edge) => {
          if (edge.source === lastNodeId) {
            return {
              ...edge,
              type: 'error-edge',
              data: {
                error: entry.errorDetails,
                onClick: () =>
                  setSelectedNode({
                    id: 'error',
                    data: {
                      label: 'Error Details',
                      type: 'error',
                      steps: [
                        {
                          error: entry.errorDetails,
                          status: 'failed',
                        },
                      ],
                    },
                  }),
              },
              style: {
                stroke: 'rgba(211, 47, 47, 0.4)',
              },
            };
          }
          return edge;
        });
        setRegularEdges([...updatedEdges]);
        const newNodes = nodes.map((node, index) => {
          return {
            ...node,
            type: node.data.type === 'model' ? 'deploymentCustom' : node.data.type === 'tool' ? 'toolCustom' : 'custom',
            position: {
              ...node.position,
              x: node.position.x * 1.8 // Add 80% more horizontal spacing for wider nodes
            },
            data: {
              ...node.data,
              isSelected: node.id == selectedNode?.id ? true : false,
              currentStep: disableCycles ? node.data.sequence : cycles[selectedCycle]?.steps[0],
              selectedCycle: cycles[selectedCycle],
              selectedCycleIndex: selectedCycle,
              disableCycles: disableCycles,
              allSteps: disableCycles ? node.data.sequence : undefined,
              onClick: () => handleNodeClick(node),
            },
          };
        });
        setProcessedNodes([...newNodes]);
      } else {
        // Create dangling error edge
        const lastNode = nodes.find((node) => node.id === lastNodeId);
        const sourcePosition = lastNode?.position || { x: 0, y: 0 };
        const danglingEdge = {
          id: 'dangling-error-edge',
          source: lastNodeId,
          target: 'dangling-end',
          type: 'error-end',

          data: {
            error: entry.errorDetails,
            onClick: () =>
              setSelectedNode({
                id: 'error',
                data: {
                  label: 'Error Details',
                  type: 'error-end',
                  steps: [
                    {
                      error: entry.errorDetails,
                      status: 'failed',
                    },
                  ],
                },
              }),
          },
          style: {
            stroke: 'rgba(211, 47, 47, 0.4)',
            strokeWidth: 3,
            transition: 'all 0.2s ease',
          },
        };

        const danglingNode = {
          id: 'dangling-end',
          type: 'error-node',
          position: { x: sourcePosition.x + 50, y: sourcePosition.y + 250 },
          data: {
            label: 'Error Details',
            type: 'error',
            steps: [
              {
                error: entry.errorDetails,
                status: 'failed',
              },
            ],
          },
          style: {
            visibility: 'hidden',
          },
        };

        let newNodes = [...nodes, danglingNode];
        newNodes = newNodes.map((node) => {
          return {
            ...node,
            type: node.data.type === 'model' ? 'deploymentCustom' : node.data.type === 'tool' ? 'toolCustom' : 'custom',
            position: {
              ...node.position,
              x: node.position.x * 1.8 // Add 80% more horizontal spacing for wider nodes
            },
            data: {
              ...node.data,
              isSelected: node.id == selectedNode?.id ? true : false,
              currentStep: disableCycles ? node.data.sequence : cycles[selectedCycle]?.steps[0],
              selectedCycle: cycles[selectedCycle],
              selectedCycleIndex: selectedCycle,
              disableCycles: disableCycles,
              allSteps: disableCycles ? node.data.sequence : undefined,
              onClick: () => handleNodeClick(node),
            },
          };
        });

        setProcessedNodes([...newNodes]);
        setRegularEdges([...edges, danglingEdge]);
      }
    } else {
      const newNodes = nodes.map((node) => {
        return {
          ...node,
          type: node.data.type === 'model' ? 'deploymentCustom' : node.data.type === 'tool' ? 'toolCustom' : 'custom',
          position: {
            ...node.position,
            x: node.position.x * 1.5 // Add 50% more horizontal spacing
          },
          data: {
            ...node.data,
            isSelected: node.id == selectedNode?.id ? true : false,
            currentStep: disableCycles ? node.data.sequence : cycles[selectedCycle]?.steps[0],
            selectedCycle: cycles[selectedCycle],
            selectedCycleIndex: selectedCycle,
            disableCycles: disableCycles,
            allSteps: disableCycles ? node.data.sequence : undefined,
            onClick: () => handleNodeClick(node),
          },
        };
      });
      setProcessedNodes([...newNodes]);
      setRegularEdges(edges);
    }
  }, [nodes, edges, entry, selectedNode, selectedCycle, disableCycles]);

  // Calculate initial viewport to center on first node
  React.useEffect(() => {
    if (processedNodes.length > 0) {
      // Find the first node (lowest Y position, then lowest X if tied)
      const firstNode = processedNodes.reduce((first, current) => {
        if (!first) return current;
        if (current.position.y < first.position.y) return current;
        if (current.position.y === first.position.y && current.position.x < first.position.x) return current;
        return first;
      }, null);

      if (firstNode) {
        // Center the view on the first node with some zoom
        setInitialViewport({
          x: -firstNode.position.x + 200, // Offset to center in viewport
          y: -firstNode.position.y + 100, // Offset to center in viewport  
          zoom: 0.8 // Nice zoom level to see details
        });
        console.log('🎯 Centering view on first node:', firstNode.data.label, 'at position:', firstNode.position);
      }
    }
  }, [processedNodes]);

  const handlePaneClick = () => {
    setSelectedNode(null);
  };

  React.useEffect(() => {
    if (!open) {
      setSelectedNode(null);
    }
  }, [open]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  // Function to find the path for a specific step
  const findStepPath = (step) => {
    const path = {
      nodes: [],
      edges: [],
    };

    const visitedNodes = new Set();

    // Find the initial node that contains this step
    const currentNode = processedNodes.find((node) => node.data.sequence?.includes(step));
    if (!currentNode) return path;

    // Get the current cycle
    const cycleSteps = cycles[selectedCycle] || {};
    // Only traverse through steps in the current cycle
    let currentStep = step;
    let currentNodeId = currentNode.id;

    // Add first node
    path.nodes.push(currentNodeId);
    visitedNodes.add(currentNodeId);

    // Forward traversal within cycle
    while (true) {
      const nextStep = currentStep + 1;
      if (!cycleSteps) break;
      // Break if next step is not in the cycle
      if (!cycleSteps?.steps?.includes(nextStep)) break;

      const nextNode = processedNodes.find((node) => node.data.sequence?.includes(nextStep));
      if (!nextNode) break;

      path.nodes.push(nextNode.id);

      // Add edge (real or phantom)
      const connectingEdge = processedEdges.find(
        (edge) => edge.source === currentNodeId && edge.target === nextNode.id
      );

      if (connectingEdge) {
        path.edges.push({
          id: connectingEdge.id,
          source: currentNodeId,
          target: nextNode.id,
          isPhantom: false,
          type: 'smart',
        });
      } else {
        path.edges.push({
          id: `phantom-${currentNodeId}-${nextNode.id}`,
          source: currentNodeId,
          target: nextNode.id,
          isPhantom: true,
          type: 'smart',
        });
      }

      if (visitedNodes.has(nextNode.id)) break;
      visitedNodes.add(nextNode.id);

      currentStep = nextStep;
      currentNodeId = nextNode.id;
    }

    return path;
  };

  // Update processed nodes and edges with highlighting
  React.useEffect(() => {
    // Start with regular edges
    const updatedEdges = regularEdges.map((edge) => {
      const isHighlighted = highlightedPath.edges.some(
        (e) => e.id === edge.id || (e.source === edge.source && e.target === edge.target)
      );

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: isHighlighted ? '#1976d2' : '#a7a7ab',
          strokeWidth: isHighlighted ? 5 : 2,
          zIndex: 1000, // High z-index to appear above nodes
        },
        markerEnd: isHighlighted
          ? {
            type: MarkerType.ArrowClosed,
            color: '#1976d2',
            width: 10,
            height: 10,
          }
          : {
            type: null,
          },
        animated: isHighlighted,
        zIndex: 1000, // High z-index to appear above nodes
      };
    });

    // Add phantom edges from the current highlighted path
    const phantomEdges = highlightedPath.edges
      .filter((edge) => edge.isPhantom)
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: {
          stroke: '#1976d2',
          strokeWidth: 5,
          strokeDasharray: '5, 5',
          opacity: 1,
          zIndex: 1000, // High z-index to appear above nodes
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#1976d2',
          width: 10,
          height: 10,
        },
        type: 'smart',
        animated: true,
        zIndex: 1000, // High z-index to appear above nodes
      }));

      // Helper function to get node position
      const getNodePosition = (nodeId) => {
        const node = processedNodes.find(n => n.id === nodeId);
        return node?.position || { x: 0, y: 0 };
      };

      // Helper function to filter and process edges
      const processEdges = (edges) => {
        // Remove self-loops
        let filteredEdges = edges.filter((edge) => edge.source !== edge.target);
        
        // Group edges by their endpoints to find bidirectional pairs
        const edgeMap = new Map();
        filteredEdges.forEach(edge => {
          const sourcePos = getNodePosition(edge.source);
          const targetPos = getNodePosition(edge.target);
          
          // Create a key for the edge pair (sorted to handle both directions)
          const key = [edge.source, edge.target].sort().join('-');
          
          if (!edgeMap.has(key)) {
            edgeMap.set(key, []);
          }
          
          edgeMap.get(key).push({
            ...edge,
            sourcePos,
            targetPos,
            isUpward: sourcePos.y > targetPos.y // source is below target
          });
        });

        // Process each edge group
        const finalEdges = [];
        
        edgeMap.forEach((edgeGroup, key) => {
          if (edgeGroup.length === 1) {
            const edge = edgeGroup[0];
            const sourcePos = edge.sourcePos;
            const targetPos = edge.targetPos;
            
            // Calculate if nodes are at same level (horizontal connection)
            const isHorizontal = Math.abs(sourcePos.y - targetPos.y) < 50; // 50px tolerance for "same level"
            const isLeftToRight = sourcePos.x < targetPos.x;
            
            if (isHorizontal) {
              // Horizontal connection - use left/right handles with straight lines
              finalEdges.push({
                ...edge,
                sourceHandle: isLeftToRight ? 'right' : 'left',
                targetHandle: isLeftToRight ? 'left' : 'right',
                type: 'straight',
                zIndex: 1000, // High z-index to appear above nodes
                style: {
                  ...edge.style,
                  zIndex: 1000, // High z-index to appear above nodes
                }
              });
            } else if (!edge.isUpward) {
              // Regular top-to-bottom edge
              finalEdges.push({
                ...edge,
                zIndex: 1000, // High z-index to appear above nodes
                style: {
                  ...edge.style,
                  zIndex: 1000, // High z-index to appear above nodes
                }
              });
            } else {
              // Bottom-to-top edge - check horizontal position for smart routing
              const dx = Math.abs(sourcePos.x - targetPos.x);
              const isSourceLeft = sourcePos.x < targetPos.x;
              const isSourceRight = sourcePos.x > targetPos.x;
              
              // If A is significantly to the left or right of B, use side handles
              if (dx > 100) { // 100px threshold for "significantly" offset
                if (isSourceLeft) {
                  // A is to the left of B - connect from right of A to left of B
                  finalEdges.push({
                    ...edge,
                    sourceHandle: 'right',
                    targetHandle: 'left',
                    type: 'smart',
                    zIndex: 1000,
                    style: {
                      ...edge.style,
                      zIndex: 1000,
                    }
                  });
                } else {
                  // A is to the right of B - connect from left of A to right of B
                  finalEdges.push({
                    ...edge,
                    sourceHandle: 'left',
                    targetHandle: 'right',
                    type: 'smart',
                    zIndex: 1000,
                    style: {
                      ...edge.style,
                      zIndex: 1000,
                    }
                  });
                }
              } else {
                // A is directly below B - use top/bottom handles
                finalEdges.push({
                  ...edge,
                  sourceHandle: 'top',    // Start from top of source node
                  targetHandle: 'bottom', // End at bottom of target node
                  type: 'smart',
                  zIndex: 1000, // High z-index to appear above nodes
                  style: {
                    ...edge.style,
                    zIndex: 1000, // High z-index to appear above nodes
                  }
                });
              }
            }
          } else if (edgeGroup.length === 2) {
            // Bidirectional edges - determine if horizontal or vertical
            const edge1 = edgeGroup[0];
            const edge2 = edgeGroup[1];
            const sourcePos = edge1.sourcePos;
            const targetPos = edge1.targetPos;
            
            const isHorizontal = Math.abs(sourcePos.y - targetPos.y) < 50;
            const isLeftToRight = sourcePos.x < targetPos.x;
            
            if (isHorizontal) {
              // Horizontal bidirectional connection with straight lines
              const leftToRight = edgeGroup.find(e => e.sourcePos.x < e.targetPos.x);
              if (leftToRight) {
                finalEdges.push({
                  ...leftToRight,
                  sourceHandle: 'right',
                  targetHandle: 'left',
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: leftToRight.style?.stroke || '#1976d2',
                    width: 10,
                    height: 10,
                  },
                  markerStart: {
                    type: MarkerType.ArrowClosed,
                    color: leftToRight.style?.stroke || '#1976d2',
                    width: 10,
                    height: 10,
                  },
                  type: 'straight',
                  zIndex: 1000, // High z-index to appear above nodes
                  style: {
                    ...leftToRight.style,
                    zIndex: 1000, // High z-index to appear above nodes
                  }
                });
              }
            } else {
              // Vertical bidirectional connection
              const topToBottom = edgeGroup.find(e => !e.isUpward);
              const bottomToTop = edgeGroup.find(e => e.isUpward);
              
              if (topToBottom && bottomToTop) {
                // Show the top-to-bottom edge with bidirectional arrows
                finalEdges.push({
                  ...topToBottom,
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: topToBottom.style?.stroke || '#1976d2',
                    width: 10,
                    height: 10,
                  },
                  markerStart: {
                    type: MarkerType.ArrowClosed,
                    color: topToBottom.style?.stroke || '#1976d2',
                    width: 10,
                    height: 10,
                  },
                  zIndex: 1000, // High z-index to appear above nodes
                  style: {
                    ...topToBottom.style,
                    zIndex: 1000, // High z-index to appear above nodes
                  }
                });
              } else if (topToBottom) {
                // Only top-to-bottom exists
                finalEdges.push({
                  ...topToBottom,
                  zIndex: 1000, // High z-index to appear above nodes
                  style: {
                    ...topToBottom.style,
                    zIndex: 1000, // High z-index to appear above nodes
                  }
                });
              } else if (bottomToTop) {
                // Only bottom-to-top exists - modify connection points
                finalEdges.push({
                  ...bottomToTop,
                  sourceHandle: 'top',    // Start from top of source node
                  targetHandle: 'bottom', // End at bottom of target node
                  type: 'smart',
                  zIndex: 1000, // High z-index to appear above nodes
                  style: {
                    ...bottomToTop.style,
                    zIndex: 1000, // High z-index to appear above nodes
                  }
                });
              }
            }
          }
        });

        return finalEdges;
      };

      if (cycles.length > 1) {
        const processedRegularEdges = processEdges(updatedEdges);
        const processedPhantomEdges = processEdges(phantomEdges);
        setProcessedEdges([...processedRegularEdges, ...processedPhantomEdges]);
      } else {
        const processedRegularEdges = processEdges(updatedEdges);
        setProcessedEdges([...processedRegularEdges]);
      }
  }, [regularEdges, highlightedPath]);
  console.log('open', open);
  return (
    <Dialog
      maxWidth="xl"
      onClose={onClose}
      open={open}
      TransitionComponent={Transition}
      TransitionProps={{
        mountOnEnter: true,
        unmountOnExit: true,
      }}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        },
        '& .MuiDialog-paper': {
          height: 'calc(100vh)',
          maxHeight: 'calc(100vh)',
          width: '90vw',
          margin: '32px 0',
          position: 'fixed',
          right: 0,
          borderRadius: '12px 0 0 12px',
          overflow: 'hidden',
          marginTop: '0px !important',
          marginBottom: '0px !important',
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography variant="h6">Entry Flow Details</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            <FormControl size="small">
              <InputLabel>View Mode</InputLabel>
              <Select
                value={disableCycles ? 'flat' : 'cycles'}
                onChange={(e) => setDisableCycles(e.target.value === 'flat')}
                label="View Mode"
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="cycles">Cycles</MenuItem>
                <MenuItem value="flat">Flat View</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={onClose}>
              <XIcon />
            </IconButton>
          </Stack>
        </Stack>

        {isLoading ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Stack spacing={2} alignItems="center">
              <CircularProgress />
              <Typography color="text.secondary">Loading flow details...</Typography>
            </Stack>
          </Box>
        ) : (
          <Grid
            container
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Flow Visualization */}
            <Grid
              item
              xs={7}
              sx={{
                height: '100%',
                p: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {entryFlow && (
                  <ReactFlowProvider>
                    <ReactFlow
                      key={flowKey}
                      nodes={processedNodes}
                      edges={processedEdges}
                      edgeTypes={edgeTypes}
                      nodeTypes={nodeTypes}
                      onNodeClick={(_, node) => {
                        handleNodeClick(node);
                        setSelectedStep(node.data.sequence[0]);
                      }}
                      defaultViewport={initialViewport}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      minZoom={0.1}
                      maxZoom={4}
                      onPaneClick={handlePaneClick}
                    >
                      <Background />
                      <Controls showZoom={true} showFitView={false} showInteractive={false} />
                    </ReactFlow>
                  </ReactFlowProvider>
                )}
              </Box>
            </Grid>

            {/* Details Panel */}
            <Grid
              item
              xs={5}
              sx={{
                height: '100%',
                borderLeft: 1,
                borderColor: 'divider',
                overflow: 'auto',
              }}
            >
              <Box sx={{ p: 2 }}>
                {selectedNode ? (
                  <NodeDetails
                    node={selectedNode}
                    cycles={cycles}
                    selectedCycle={selectedCycle}
                    onCycleChange={handleCycleChange}
                    onImageSelect={setSelectedImage}
                    model={model}
                    onNodeUpdate={onNodeUpdate}
                    setCurrentStepIndex={setCurrentStepIndex}
                    currentStepIndex={currentStepIndex}
                    disableCycles={disableCycles}
                  />
                ) : (
                  <EntryOverview
                    cycles={cycles}
                    selectedCycle={selectedCycle}
                    onCycleChange={handleCycleChange}
                    entryFlow={entryFlow}
                    onImageSelect={setSelectedImage}
                    entry={entry}
                    model={model}
                    disableCycles={disableCycles}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <ImageDialog open={Boolean(selectedImage)} onClose={() => setSelectedImage(null)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full size preview"
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </ImageDialog>
    </Dialog>
  );
}
