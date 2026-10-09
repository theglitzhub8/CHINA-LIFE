<?php
// Copy to ai-config.php on the server (same folder as ai.php) and add your Anthropic API key.
// ai-config.php is ignored by git: never commit the API key. Players never see it.
return [
    'api_key' => 'YOUR_ANTHROPIC_API_KEY',
    // Claude model for the city characters. claude-sonnet-5-5 is a strong default; claude-haiku-4-5-20251001 is
    // cheaper and faster if you have many players.
    'model' => 'claude-sonnet-5-5',
    // Messages each player can send to the AI characters per day (all characters together).
    'daily_limit' => 40,
    // Set to false to switch the AI characters off without removing the key.
    'enabled' => true,
];
