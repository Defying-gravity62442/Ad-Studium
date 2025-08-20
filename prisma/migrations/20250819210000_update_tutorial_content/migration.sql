-- Update existing tutorial steps with new content
UPDATE "TutorialStep" SET
    title = 'Welcome to Ad Studium',
    description = 'Your personal PhD journey companion',
    content = '<p>Welcome to <strong>Ad Studium</strong>—your companion on the path to research and discovery.</p>
<p>This is your dashboard, where your ambitions take shape and your progress becomes visible.</p>
<p><em>Ad Studium</em> means "towards study, pursuit, and enthusiasm" in Latin. Every great researcher starts with a journey—yours begins here, and we''re here to walk it with you.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 1;

UPDATE "TutorialStep" SET
    title = 'Navigation Menu',
    description = 'Learn how to navigate between features',
    content = '<p>Your journey has many dimensions—here''s how to navigate them:</p>
<ul>
  <li><strong>Dashboard</strong> - A bird''s-eye view of your growth</li>
  <li><strong>Journal</strong> - Capture your thoughts; see new insights unfold</li>
  <li><strong>Roadmap</strong> - Transform big dreams into concrete steps</li>
  <li><strong>Letter</strong> - Speak to your future self with honesty and hope</li>
  <li><strong>Reading</strong> - Engage deeply with the work that inspires you</li>
  <li><strong>History</strong> - Look back to see how far you''ve come</li>
</ul>
<p>Every feature is a stepping stone on your path forward.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 2;

UPDATE "TutorialStep" SET
    title = 'Upcoming Items',
    description = 'Stay on top of your milestones and commitments',
    content = '<p>The <strong>Upcoming</strong> card keeps your goals within reach:</p>
<ul>
  <li>Milestones approaching their due dates</li>
  <li>Letters ready to be opened when you most need them</li>
</ul>
<p>Plan boldly, and let us help you stay aligned. You can even sync with Google Calendar so you never lose sight of what matters.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 3;

UPDATE "TutorialStep" SET
    title = 'Proof of Progress',
    description = 'See how far you''ve come on your journey',
    content = '<p>When days feel busy and scattered, this card reminds you of the bigger picture:</p>
<ul>
  <li>Weekly, monthly, and yearly proof of your progress</li>
  <li>Insights revealed from your journals</li>
  <li>Milestones you''ve already conquered</li>
</ul>
<p>Every entry, every step builds momentum. Over time, you''ll see not just what you''ve done—but who you''re becoming.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 4;

UPDATE "TutorialStep" SET
    title = 'Mood Insights',
    description = 'Understand your emotional patterns',
    content = '<p>Your research journey is as much about the heart as the mind. This card helps you listen to yourself:</p>
<ul>
  <li>Discover emotional patterns over time</li>
  <li>Notice how your work and mood intertwine</li>
  <li>Receive reminders to pause, reflect, and care for yourself</li>
</ul>
<p>Because thriving as a scholar means thriving as a person, too!</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 5;

UPDATE "TutorialStep" SET
    title = 'Reading Statistics',
    description = 'Monitor your academic reading progress',
    content = '<p>Every great idea begins with deep reading and reflection. This card shows how you grow to become a thinker:</p>
<ul>
  <li>Track the papers and books shaping your path</li>
  <li>See progress across your reading sessions</li>
  <li>Capture reflections that turn knowledge into wisdom</li>
</ul>
<p>Upload your readings, engage with them fully, and let them spark your next breakthrough.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 6;

UPDATE "TutorialStep" SET
    title = 'Ready to Start!',
    description = 'You''re all set for your PhD journey',
    content = '<p>🎉 <strong>Congratulations!</strong> You''ve completed the tutorial.</p>
    <p>Now your journey truly begins. Here are some powerful first steps:</p>
    <ul>
    <li><strong>Journal</strong> - Start writing about your day of research and chat about it with your AI Companion!</li>
    <li><strong>Roadmap</strong> - Chart the course that bring your dreams closer!</li>
    <li><strong>Reading</strong> - Upload a paper or textbook and learn to think like a researcher!</li>
    <li><strong>Letter</strong> - Dear future self, by the time I unseal this letter, I wish you''ve...</li>
    </ul>
    <p>Remember: your journey is uniquely yours. Every word, every milestone, every reflection matters. And with Ad Studium by your side, you never walk it alone.</p>',
    "updatedAt" = NOW()
WHERE "stepNumber" = 7;
