// Shot zones + commentary templates for the ShotZonePicker.
// 8 zones around the pitch. Angles are in degrees, measured clockwise from
// NORTH (= bowler's end, straight ahead from the batsman's perspective).
// These values assume a RIGHT-HAND batter (off side = east/right on screen).
// Flip is handled at render time by mirroring x-coords.

export const ZONES = [
  { id: 'straight',    label: 'Straight',    side: 'v',    start: 345,   end: 15 },
  { id: 'mid_off',     label: 'Mid-off',     side: 'off',  start: 15,    end: 50 },
  { id: 'cover',       label: 'Cover',       side: 'off',  start: 50,    end: 85 },
  { id: 'point',       label: 'Point',       side: 'off',  start: 85,    end: 125 },
  { id: 'third_man',   label: 'Third man',   side: 'off',  start: 125,   end: 160 },
  { id: 'fine_leg',    label: 'Fine leg',    side: 'leg',  start: 200,   end: 235 },
  { id: 'square_leg',  label: 'Square leg',  side: 'leg',  start: 235,   end: 275 },
  { id: 'mid_wicket',  label: 'Mid-wicket',  side: 'leg',  start: 275,   end: 315 },
  { id: 'mid_on',      label: 'Mid-on',      side: 'leg',  start: 315,   end: 345 },
];

// The rear wedge (157.5° to 202.5°) is left as the keeper zone — un-tappable.

// Labels swap for boundaries (4s become "Deep ___").
export const zoneLabelForRuns = (zoneId, isBoundary) => {
  const z = ZONES.find((x) => x.id === zoneId);
  if (!z) return '';
  if (!isBoundary) return z.label;
  const map = {
    straight: 'Straight',
    mid_off: 'Long-off',
    cover: 'Deep cover',
    point: 'Deep point',
    third_man: 'Third man',
    fine_leg: 'Fine leg',
    square_leg: 'Deep square leg',
    mid_wicket: 'Deep mid-wicket',
    mid_on: 'Long-on',
  };
  return map[zoneId] || z.label;
};

// Commentary — 4 phrases per zone × 3 tiers (single/two-three/boundary/six).
// buildCommentary(zone, runs, isBoundary, isSix) picks one at random.
const C = {
  straight: {
    single:   ['pushed straight for one', 'driven down the ground, quick single', 'tapped back to the bowler, single taken', 'worked straight, one run'],
    couple:   ['driven straight for two', 'punched back past the bowler, couple', 'two runs, straight down the ground', 'crisp drive straight, two taken'],
    four:     ['straight drive, all the way!', 'down the ground, straight as an arrow', 'beaten the bowler, straight four', 'drilled straight past the stumps to the fence'],
    six:      ['launched straight back, huge six!', 'straight down the ground for maximum', 'picked him up straight, clean strike', 'over the sightscreen, straight and long'],
  },
  mid_off: {
    single:   ['pushed to mid-off for one', 'driven straight, quick single', 'worked to mid-off, called through', 'tapped towards mid-off'],
    couple:   ['firmly driven to mid-off, two taken', 'punched past mid-off, scampering back', 'two runs into the V', 'nicely placed to mid-off'],
    four:     ['drilled down the ground, long-off beaten', 'silky drive, no chase', 'punched past the bowler to the fence', 'straight drive, all the way'],
    six:      ['launched straight back over the bowler', 'huge hit, over long-off', 'lofted down the ground for a maximum', 'clean strike, sails into the crowd'],
  },
  cover: {
    single:   ['pushed to cover for one', 'driven to cover, quick single', 'tapped to cover, called through', 'steered to cover for one'],
    couple:   ['driven through cover, two runs', 'cracked to cover, turned back for two', 'cover driven, easy couple', 'punched wide of cover, two'],
    four:     ['cracking cover drive, races away', 'silken through the covers', 'cover drive, off the middle', 'timing! cover point beaten'],
    six:      ['lofted over cover, huge', 'clean over deep cover for six', 'inside-out, over cover, gone', 'cleared deep cover, maximum'],
  },
  point: {
    single:   ['cut to point for a single', 'steered to point', 'dabbed to point, one run', 'late cut to point'],
    couple:   ['cut square, two runs', 'slashed to point, taken back for two', 'two to point, sharp running', 'square-driven past point'],
    four:     ['cracking cut, races to the fence', 'slashed past point, four', 'late cut, fine placement', 'square cut, all four'],
    six:      ['uppercut over point, six!', 'flayed over deep point', 'clean strike, clears point', 'launched over backward point'],
  },
  third_man: {
    single:   ['dabbed to third man', 'steered behind for one', 'guided to third man, single', 'late cut, single'],
    couple:   ['thick edge to third man, two runs', 'steered past slip, couple', 'two down to third man', 'edged safely, two runs'],
    four:     ['edged through the slips to the fence', 'guided finely to third man for four', 'late cut past the keeper, boundary', 'thick edge, races away'],
    six:      ['uppercut over the slips for six', 'edged over third man, and gone!', 'ramp shot, clears the keeper', 'clean over third man, six'],
  },
  fine_leg: {
    single:   ['glanced to fine leg', 'tickled down leg for one', 'worked behind square, single', 'flicked fine for one'],
    couple:   ['glanced fine, two runs', 'worked behind square, couple', 'flicked off the pads, two', 'nudged fine, two taken'],
    four:     ['glanced fine for four', 'flicked off the hip to the fence', 'paddle sweep, boundary', 'tickled down leg, all the way'],
    six:      ['lofted over fine leg for six', 'scooped over the keeper, maximum', 'ramped over fine leg, gone', 'clean scoop, six!'],
  },
  square_leg: {
    single:   ['pulled to square leg for one', 'tapped to square leg', 'worked square, single', 'nudged to square leg'],
    couple:   ['pulled square, two runs', 'clipped to square leg, couple', 'sweep, two taken', 'worked square for two'],
    four:     ['pulled to the square leg fence', 'cracking pull, four', 'swept square, boundary', 'clipped off the pads, races away'],
    six:      ['pulled over deep square leg, six', 'huge pull, all the way', 'swept flat, clears the rope', 'launched over square, maximum'],
  },
  mid_wicket: {
    single:   ['flicked to mid-wicket', 'worked to mid-wicket for one', 'clipped to mid-wicket', 'nudged to mid-wicket'],
    couple:   ['flicked wide of mid-wicket, two', 'two to mid-wicket, good running', 'punched wide of mid-wicket', 'worked to mid-wicket, couple'],
    four:     ['whipped past mid-wicket for four', 'clipped off the pads to the fence', 'lofted drive to deep mid-wicket', 'cracking flick, boundary'],
    six:      ['launched over deep mid-wicket, huge six', 'slog over mid-wicket, gone', 'into the stands over mid-wicket', 'clean swing, maximum to mid-wicket'],
  },
  mid_on: {
    single:   ['pushed to mid-on for one', 'worked to mid-on', 'tapped to mid-on, called through', 'driven to mid-on, single'],
    couple:   ['driven to mid-on, two runs', 'punched past mid-on, couple', 'two into the V on the leg side', 'clipped to mid-on, two'],
    four:     ['lofted straight over mid-on', 'smashed down the ground past mid-on', 'driven to long-on, four', 'clean strike past mid-on'],
    six:      ['hoisted over long-on, maximum', 'launched over mid-on, gone', 'clean over long-on, six', 'flat hit over mid-on, into the stands'],
  },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const buildCommentary = (zoneId, runs, isBoundary = false, isSix = false) => {
  const zone = C[zoneId];
  if (!zone) return '';
  if (isSix) return pick(zone.six);
  if (isBoundary) return pick(zone.four);
  if (runs === 1) return pick(zone.single);
  if (runs === 2 || runs === 3) return pick(zone.couple);
  return pick(zone.single);
};
