<?php
// How the game polls the server. 'adaptive' (default): one presence heartbeat carries change counters, other
// checks run only when something changed (with a slow safety poll). 'legacy': the previous fixed fast timers.
// Switching to 'legacy' is the rollback for performance Batch 1: games pick it up within about 15 seconds.
return ['mode' => 'adaptive'];
