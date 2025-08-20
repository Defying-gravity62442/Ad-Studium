-- Update existing tutorial steps or create new ones
INSERT INTO "TutorialStep" (id, "stepNumber", title, description, "targetPage", "targetElement", content, "isActive", "createdAt", "updatedAt") VALUES
('step_1', 1, 'Welcome to Ad Studium', 'Your personal PhD journey companion', '/dashboard', '[data-tutorial="welcome-message"]', '<p>Welcome to <strong>Ad Studium</strong>—your companion on the path to research and discovery.</p>
<p>This is your dashboard, where your ambitions take shape and your progress becomes visible.</p>
<p><em>Ad Studium</em> means “towards study, pursuit, and enthusiasm” in Latin. Every great researcher starts with a journey—yours begins here, and we&apos;re here to walk it with you.</p>', true, NOW(), NOW()),

('step_2', 2, 'Navigation Menu', 'Learn how to navigate between features', '/dashboard', '[data-tutorial="navigation"]', '<p>Your journey has many dimensions—here&apos;s how to navigate them:</p>
<ul>
  <li><strong>Dashboard</strong> - A bird&apos;s-eye view of your growth</li>
  <li><strong>Journal</strong> - Capture your thoughts; see new insights unfold</li>
  <li><strong>Roadmap</strong> - Transform big dreams into concrete steps</li>
  <li><strong>Letter</strong> - Speak to your future self with honesty and hope</li>
  <li><strong>Reading</strong> - Engage deeply with the work that inspires you</li>
  <li><strong>History</strong> - Look back to see how far you&apos;ve come</li>
</ul>
<p>Every feature is a stepping stone on your path forward.</p>', true, NOW(), NOW()),

('step_3', 3, 'Upcoming Items', 'Stay on top of your milestones and commitments', '/dashboard', '[data-tutorial="upcoming-card"]', '<p>The <strong>Upcoming</strong> card keeps your goals within reach:</p>
<ul>
  <li>Milestones approaching their due dates</li>
  <li>Letters ready to be opened when you most need them</li>
</ul>
<p>Plan boldly, and let us help you stay aligned. You can even sync with Google Calendar so you never lose sight of what matters.</p>', true, NOW(), NOW()),

('step_4', 4, 'Proof of Progress', 'See how far you''ve come on your journey', '/dashboard', '[data-tutorial="progress-card"]', '<p>When days feel busy and scattered, this card reminds you of the bigger picture:</p>
<ul>
  <li>Weekly, monthly, and yearly proof of your progress</li>
  <li>Insights revealed from your journals</li>
  <li>Milestones you&apos;ve already conquered</li>
</ul>
<p>Every entry, every step builds momentum. Over time, you&apos;ll see not just what you&apos;ve done—but who you&apos;re becoming.</p>', true, NOW(), NOW()),

('step_5', 5, 'Mood Insights', 'Understand your emotional patterns', '/dashboard', '[data-tutorial="mood-card"]', '<p>Your research journey is as much about the heart as the mind. This card helps you listen to yourself:</p>
<ul>
  <li>Discover emotional patterns over time</li>
  <li>Notice how your work and mood intertwine</li>
  <li>Receive reminders to pause, reflect, and care for yourself</li>
</ul>
<p>Because thriving as a scholar means thriving as a person, too!</p>', true, NOW(), NOW()),

('step_6', 6, 'Reading Statistics', 'Monitor your academic reading progress', '/dashboard', '[data-tutorial="reading-card"]', '<p>Every great idea begins with deep reading and reflection. This card shows how you grow to become a thinker:</p>
<ul>
  <li>Track the papers and books shaping your path</li>
  <li>See progress across your reading sessions</li>
  <li>Capture reflections that turn knowledge into wisdom</li>
</ul>
<p>Upload your readings, engage with them fully, and let them spark your next breakthrough.</p>', true, NOW(), NOW()),

('step_7', 7, 'Ready to Start!', 'You''re all set for your PhD journey', '/dashboard', NULL, '<p>🎉 <strong>Congratulations!</strong> You&apos;ve completed the tutorial.</p>
    <p>Now your journey truly begins. Here are some powerful first steps:</p>
    <ul>
    <li><strong>Journal</strong> - Start writing about your day of research and chat about it with your AI Companion!</li>
    <li><strong>Roadmap</strong> - Chart the course that bring your dreams closer!</li>
    <li><strong>Reading</strong> - Upload a paper or textbook and learn to think like a researcher!</li>
    <li><strong>Letter</strong> - Dear future self, by the time I unseal this letter, I wish you&apos;ve...</li>
    </ul>
    <p>Remember: your journey is uniquely yours. Every word, every milestone, every reflection matters. And with Ad Studium by your side, you never walk it alone.</p>', true, NOW(), NOW())

ON CONFLICT ("stepNumber") DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    "targetPage" = EXCLUDED."targetPage",
    "targetElement" = EXCLUDED."targetElement",
    content = EXCLUDED.content,
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = NOW();