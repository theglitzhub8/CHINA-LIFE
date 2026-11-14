# ChinaLife: every task left (14 Nov 2026)

One list, in the order I would do them. Each step ships on its own with a switch in Hafrik integrations.
Size: S = an hour or two, M = half a day, L = a day or more. "Map" = touches the approved city map (owner sees it first).

## Shipped 14 Nov
- **The Gym** as the 8th shared-city place, with a "Work out at the gym" task in Today's Three (from 15 Nov). Map.
- **Bottom docks for the University and the Gym**: every shared-city place now has the club-style row.

## Next: finish the Today plan (docs/TODAY-PLAN.md)
1. ✅ (14 Nov, live after the next ship) **Phase 3, the next-step chip** (S, Map). The "Next step" chip under the top bar shows the next unfinished task of
   Today's Three with Go ("🎯 Drop a tip · +¥100 · Go"), then the bonus, then the usual hints.
2. **Phase 4, event screens** (M). One screen for Match Day / cups, elections and Hot Seat Hour: countdown, Top 3 in
   your city (goals today, votes, gossip rep), your own line, the reward, one Go.
3. **Phase 5, What's new and How it works** (S). A dated "What's new" sheet once after an update; a one-time
   "How it works · Got it" card on Today's Three, Football, Voting, the Gossip Centre and the Gym.

## Then: more reasons to come back (ideas from Vatarverse, in ChinaLife's own style)
4. **Weekly story** (M). A 7-step story each week ("Exam Week", "Fitness Week"): one step a day, each a place and an
   action, a prize at step 7. Uses the same server checks as Today's Three.
5. **City Album** (L). A card for each place visited and each thing done; finish a set for a prize; trade spares.
6. **Season track** (M). Today's Three, the weekly story and events give Season XP; tiers with rewards over a month.
7. **Gym extras** (S, optional). The Gym in first-visit bonuses (eight places), a live pulse on Train when friends are
   there, and a weekly "most workouts" podium.

## Owner jobs (only you can do these)
- **Approve election nominations** in Admin → Politics, so the ballot is not empty.
- **Streak reminder cron**: check `tail -5 /var/log/chinalife-streak.log` after 19:00 Beijing shows "sent".
- **Watch Admin → Energy** for a week: "Came back next day" and "Today's Three done" tell us what works.

## Housekeeping
- **Merge to main.** Live is deployed from `feature/one-city-where-to`; CLAUDE.md says only `main` is deployed.
  Merge the branch into `main` so the record matches what players have.
- **Perf Batch 1** (from an earlier session): prepared on `perf/batch-1`, never deployed. Check if still wanted.
- **One flaky test** (a timing test fails only under full-suite load). Make it wait for the condition instead of a
  fixed time.
