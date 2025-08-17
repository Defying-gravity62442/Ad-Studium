# AI Privacy Controls - Daily Summary Management

## Overview

The "Hide Daily Summary from AI" feature allows users to control which of their daily journal summaries are shared with AI systems for generating weekly/monthly summaries and providing context for AI conversations.

## How It Works

### Database Schema
- Each `DailySummary` record has an `isHiddenFromAI` boolean field (defaults to `false`)
- When `isHiddenFromAI` is `true`, the summary is excluded from:
  - Weekly summary generation
  - Monthly summary generation  
  - AI companion context
  - AI prompt context

### API Endpoints

#### PATCH `/api/journal/summary/save`
Updates the `isHiddenFromAI` flag for a specific daily summary.

**Request Body:**
```json
{
  "summaryId": "string",
  "isHiddenFromAI": boolean
}
```

**Response:**
```json
{
  "success": true,
  "summaryId": "string",
  "isHiddenFromAI": boolean
}
```

### User Interface

#### History Page (`/history`)
- **Visual Indicators**: Hidden summaries have a yellow background and "Hidden from AI" badge
- **Toggle Button**: Each daily summary has a "Hide from AI" / "Show to AI" button
- **Information Panel**: Explains the feature and its privacy benefits

#### Visual States
- **Visible to AI**: Gray background, "Hide from AI" button (red)
- **Hidden from AI**: Yellow background, "Show to AI" button (green), "Hidden from AI" badge

## Privacy Benefits

1. **Granular Control**: Users can hide sensitive content while keeping other summaries available for AI assistance
2. **Context Management**: Hidden summaries won't influence AI-generated weekly/monthly summaries
3. **Conversation Privacy**: AI companion won't have access to hidden content
4. **Transparency**: Clear visual indicators show which content is shared with AI

## Technical Implementation

### Backend Logic
- Hierarchical summary generation filters out hidden summaries using `isHiddenFromAI: false`
- Context gathering services respect the hidden flag
- API endpoints validate user ownership before allowing updates

### Frontend State Management
- Real-time UI updates when toggling visibility
- Optimistic updates for better user experience
- Error handling with user feedback

## Usage Instructions

1. Navigate to the History page (`/history`)
2. Find a journal entry with a daily summary
3. Click the "Hide from AI" button to prevent that summary from being used by AI
4. Click "Show to AI" to re-enable AI access to that summary
5. Hidden summaries are visually distinguished with yellow styling and badges

## Security Considerations

- Only the summary owner can modify the `isHiddenFromAI` flag
- API endpoints validate user authentication and ownership
- The feature respects existing encryption and privacy measures
- Hidden summaries remain encrypted and secure in the database
