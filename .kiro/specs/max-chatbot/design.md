# Max Chatbot Design Document

## Overview

Max is a client-side AI chatbot that provides instant support for StellarRec users. The chatbot will be implemented as a floating widget that appears on all pages, using a combination of predefined responses and simple pattern matching to provide helpful, contextual information about the StellarRec platform.

## Architecture

### Client-Side Implementation
- **Pure JavaScript**: No external dependencies for core functionality
- **CSS Animations**: Smooth transitions and engaging micro-interactions
- **Local Storage**: Persist conversation history and user preferences
- **Responsive Design**: Works seamlessly across desktop and mobile devices

### Knowledge Base Structure
- **JSON Configuration**: Easily updatable question-answer pairs
- **Pattern Matching**: Flexible keyword and phrase recognition
- **Fallback Responses**: Graceful handling of unknown queries
- **Context Awareness**: Basic understanding of user journey and page context

## Components and Interfaces

### 1. Chat Widget Component
```javascript
// Main chatbot interface
class MaxChatbot {
  constructor(config) {
    this.knowledgeBase = config.knowledgeBase;
    this.isOpen = false;
    this.conversationHistory = [];
  }
  
  init() {
    this.createWidget();
    this.bindEvents();
    this.loadConversationHistory();
  }
}
```

### 2. Knowledge Base Structure
```json
{
  "greetings": {
    "patterns": ["hello", "hi", "hey", "start"],
    "responses": [
      "Hi there! I'm Max, your StellarRec guide! ⭐ How can I help you navigate the world of university recommendations today?",
      "Hello! Welcome to StellarRec! I'm Max, and I'm here to help you understand how we make recommendations stellar! What would you like to know?"
    ]
  },
  "platform_overview": {
    "patterns": ["what is stellarrec", "how does it work", "platform", "overview"],
    "responses": [
      "StellarRec transforms the recommendation process! Recommenders upload once and send to many universities, saving time while helping students reach more schools. It's like having a recommendation rocket ship! 🚀"
    ]
  }
}
```

### 3. UI Components

#### Chat Widget Button
- **Position**: Fixed bottom-right corner
- **Design**: Circular button with star icon and "Max" label
- **Animation**: Gentle pulse effect to draw attention
- **Notification**: Badge indicator for new messages or tips

#### Chat Interface
- **Layout**: Expandable chat window (320px width on desktop)
- **Header**: Max branding with minimize/close controls
- **Messages**: Conversation bubbles with timestamps
- **Input**: Text input with send button and quick action buttons
- **Styling**: Consistent with StellarRec brand colors and typography

## Data Models

### Conversation Message
```javascript
{
  id: "unique_message_id",
  timestamp: "2025-01-XX 10:30:00",
  sender: "user" | "max",
  content: "message text",
  type: "text" | "quick_action" | "suggestion"
}
```

### User Session
```javascript
{
  sessionId: "unique_session_id",
  startTime: "2025-01-XX 10:00:00",
  currentPage: "index.html",
  conversationHistory: [/* messages */],
  userType: "student" | "recommender" | "unknown"
}
```

### Knowledge Base Entry
```javascript
{
  category: "platform_overview",
  patterns: ["keyword1", "phrase pattern"],
  responses: ["response option 1", "response option 2"],
  followUpSuggestions: ["Learn about features", "See demo"],
  confidence: 0.8
}
```

## Error Handling

### Unknown Query Handling
- **Fallback Responses**: "I'm still learning about that! Let me connect you with our team..."
- **Suggestion System**: Offer related topics or popular questions
- **Escalation Path**: Direct users to contact form or demo

### Technical Error Handling
- **Graceful Degradation**: If JavaScript fails, show static contact information
- **Offline Support**: Basic functionality when network is unavailable
- **Error Logging**: Track issues for improvement without compromising user privacy

## Testing Strategy

### Unit Testing
- **Pattern Matching**: Verify keyword recognition accuracy
- **Response Selection**: Test randomization and appropriateness
- **State Management**: Validate conversation history and session handling

### Integration Testing
- **Cross-Page Functionality**: Ensure chatbot works on all StellarRec pages
- **Responsive Design**: Test across different screen sizes and devices
- **Browser Compatibility**: Verify functionality across modern browsers

### User Experience Testing
- **Conversation Flow**: Test natural conversation patterns
- **Response Quality**: Validate helpfulness and accuracy of answers
- **Performance**: Ensure fast response times and smooth animations

### A/B Testing Opportunities
- **Widget Positioning**: Test different locations for optimal engagement
- **Greeting Messages**: Compare different welcome approaches
- **Response Styles**: Test formal vs. casual communication styles

## Performance Considerations

### Loading Strategy
- **Lazy Loading**: Load chatbot after page content is ready
- **Minimal Initial Bundle**: Core functionality first, extended features on demand
- **Caching**: Store knowledge base and assets for faster subsequent loads

### Memory Management
- **Conversation Limits**: Maintain reasonable history length
- **Cleanup**: Remove old sessions and temporary data
- **Efficient DOM Updates**: Minimize reflows and repaints

## Security and Privacy

### Data Handling
- **Local Storage Only**: No server-side conversation storage
- **No Personal Data**: Avoid collecting or storing sensitive information
- **Session Isolation**: Each browser session is independent

### Content Security
- **Input Sanitization**: Prevent XSS attacks through user input
- **Safe Responses**: Ensure all chatbot responses are safe and appropriate
- **Rate Limiting**: Prevent spam or abuse of the chatbot interface

## Accessibility

### Screen Reader Support
- **ARIA Labels**: Proper labeling for all interactive elements
- **Keyboard Navigation**: Full functionality without mouse
- **Focus Management**: Clear focus indicators and logical tab order

### Visual Accessibility
- **High Contrast**: Ensure readability for users with visual impairments
- **Scalable Text**: Support browser zoom and font size adjustments
- **Color Independence**: Don't rely solely on color for information

## Deployment and Maintenance

### Implementation Phases
1. **Phase 1**: Basic chat widget with core knowledge base
2. **Phase 2**: Enhanced pattern matching and conversation flow
3. **Phase 3**: Advanced features like quick actions and suggestions

### Knowledge Base Updates
- **JSON Configuration**: Easy updates without code changes
- **Version Control**: Track changes to responses and patterns
- **Testing Pipeline**: Validate updates before deployment

### Analytics and Improvement
- **Usage Metrics**: Track engagement and popular questions
- **Conversation Analysis**: Identify gaps in knowledge base
- **User Feedback**: Collect ratings on chatbot helpfulness