/**
 * features.ts — global feature kill-switches.
 */

/**
 * Interest surveys + the interest (amber) layer, across ALL schools.
 *
 * Temporarily hidden 2026-06-14. While false this hides: the "Interest Survey"
 * and "Start Class Survey" buttons + survey modal, the amber interest dots and
 * "Interest" legends on the amoeba, the "Learning Zones" matrix, the "Class
 * Interest Pulse", interest polygons/legends in dashboards, interest insight
 * cards, and interest-gap attention flags. Flip to `true` to restore.
 *
 * Underlying data and the /survey/:token route are left intact, so nothing is
 * lost and existing survey sessions still work while this is off.
 */
// Typed as boolean (not the literal `false`) so flag checks aren't flagged as
// constant/unreachable conditions while it's off.
export const INTEREST_ENABLED: boolean = false
